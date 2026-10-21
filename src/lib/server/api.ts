import "server-only";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { AgentError } from "@/lib/ai/agent";
import { FileError } from "./files";
import { verifyApiKey } from "./api-keys";
import { SkillError } from "@/lib/skills";

export type ApiAuth = { userId: string; via: "session" | "api_key" };

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

export function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

/* Simple in-memory rate limiter (per user, per minute). */
const buckets = new Map<string, { count: number; reset: number }>();
function rateLimit(key: string, limit: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + 60_000 });
    return true;
  }
  b.count++;
  return b.count <= limit;
}

export async function authenticate(req: Request): Promise<ApiAuth | null> {
  const header = req.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    const key = header.slice(7).trim();
    const row = await verifyApiKey(key);
    return row ? { userId: row.userId, via: "api_key" } : null;
  }
  const session = await auth.api.getSession({ headers: req.headers });
  return session ? { userId: session.user.id, via: "session" } : null;
}

function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
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
 * Wraps a route handler with authentication (session cookie or `Authorization: Bearer fg_live_…`),
 * CSRF protection for cookie sessions, rate limiting and uniform JSON errors.
 */
export function withApi<P = Record<string, never>>(
  handler: Handler<P>,
  opts: { sessionOnly?: boolean; rateLimit?: number } = {},
) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    try {
      const a = await authenticate(req);
      if (!a) return errorResponse(401, "unauthorized", "Sign in or pass a valid API key (Authorization: Bearer fg_live_…).");
      if (opts.sessionOnly && a.via !== "session") return errorResponse(403, "forbidden", "This endpoint is only available from the web app.");
      if (a.via === "session" && req.method !== "GET" && !sameOrigin(req)) return errorResponse(403, "csrf", "Cross-origin request blocked.");
      if (!rateLimit(`${a.userId}:${a.via}`, opts.rateLimit ?? (a.via === "api_key" ? 120 : 600)))
        return errorResponse(429, "rate_limited", "Too many requests, slow down.");
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
  console.error("[api] unhandled error", err);
  return errorResponse(500, "internal_error", "Something went wrong on our side.");
}

export async function readJson<T = unknown>(req: Request): Promise<T> {
  const text = await req.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}
