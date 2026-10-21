import "server-only";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { AgentError } from "@/lib/ai/agent";
import { FileError } from "./files";
import { SkillError } from "@/lib/skills";
import { rateLimit } from "./rate-limit";

/** Forged has no public API: every route is reachable only with a browser session cookie. */
export type ApiAuth = { userId: string };

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, init);
}

export function errorResponse(status: number, code: string, message: string, headers?: HeadersInit) {
  return Response.json({ error: { code, message } }, { status, headers });
}

export async function authenticate(req: Request): Promise<ApiAuth | null> {
  // Bearer tokens are intentionally not supported.
  if (req.headers.get("authorization")) return null;
  const session = await auth.api.getSession({ headers: req.headers });
  return session ? { userId: session.user.id } : null;
}

/** Same-origin check for state-changing requests (defence in depth on top of SameSite=Lax cookies). */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  if (!origin) return true;
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

type Handler<P> = (req: Request, ctx: { auth: ApiAuth; params: P }) => Promise<Response>;

/**
 * Wraps a route handler with session authentication, CSRF protection,
 * per-user rate limiting and uniform JSON errors (no stack traces ever leave the server).
 */
export function withApi<P = Record<string, never>>(handler: Handler<P>, opts: { rateLimit?: number; bucket?: string } = {}) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD" && !sameOrigin(req)) return errorResponse(403, "csrf", "Cross-origin request blocked.");
      const a = await authenticate(req);
      if (!a) return errorResponse(401, "unauthorized", "Please sign in.");
      const rl = rateLimit(`api:${opts.bucket ?? "default"}:${a.userId}`, opts.rateLimit ?? 300, 60_000);
      if (!rl.ok) return errorResponse(429, "rate_limited", "Too many requests, slow down a little.", { "Retry-After": String(rl.retryAfter) });
      return await handler(req, { auth: a, params: await ctx.params });
    } catch (err) {
      return handleError(err);
    }
  };
}

export function handleError(err: unknown) {
  if (err instanceof ApiError) return errorResponse(err.status, err.code, err.message);
  if (err instanceof AgentError) return errorResponse(err.status, err.code, err.message);
  if (err instanceof FileError) return errorResponse(400, "invalid_file", err.message);
  if (err instanceof SkillError) return errorResponse(400, "invalid_skill", err.message);
  if (err instanceof ZodError)
    return errorResponse(400, "invalid_request", err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  if (err instanceof SyntaxError) return errorResponse(400, "invalid_json", "Request body must be valid JSON.");
  console.error("[api] unhandled error", err instanceof Error ? `${err.name}: ${err.message}` : err);
  return errorResponse(500, "internal_error", "Something went wrong on our side.");
}

export async function readJson<T = unknown>(req: Request, maxBytes = 1_000_000): Promise<T> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > maxBytes) throw new ApiError(413, "too_large", "Request body is too large.");
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, "too_large", "Request body is too large.");
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

/** Best-effort client IP (trusted reverse proxy sets X-Forwarded-For / X-Real-IP). */
export function clientIp(req: Request | Headers) {
  const h = req instanceof Headers ? req : req.headers;
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "0.0.0.0";
}
