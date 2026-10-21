import "server-only";
import crypto from "node:crypto";

/**
 * Stateless proof-of-work challenges for sign-up. The browser must find a counter such that
 * sha256(`${token}:${counter}`) starts with `difficulty` zero bits. Tokens are HMAC-signed,
 * expire after 10 minutes and can be redeemed once.
 */

const TTL_MS = 10 * 60_000;

function key() {
  const secret = process.env.BETTER_AUTH_SECRET || process.env.FORGED_ENCRYPTION_KEY;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET is required");
  return crypto.createHash("sha256").update(`forged-pow:${secret ?? "dev-only-secret"}`).digest();
}

declare global {
  var __forgedPowUsed: Map<string, number> | undefined;
}
const used = (globalThis.__forgedPowUsed ??= new Map());

export function issueChallenge(difficulty: number) {
  const payload = Buffer.from(JSON.stringify({ n: crypto.randomBytes(12).toString("base64url"), d: difficulty, e: Date.now() + TTL_MS })).toString("base64url");
  const sig = crypto.createHmac("sha256", key()).update(payload).digest("base64url");
  return { token: `${payload}.${sig}`, difficulty, expiresInMs: TTL_MS };
}

function leadingZeroBits(buf: Buffer) {
  let bits = 0;
  for (const byte of buf) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    bits += Math.clz32(byte) - 24;
    break;
  }
  return bits;
}

export type PowResult = { ok: true; difficulty: number } | { ok: false; reason: string };

/** Verifies and consumes a solution `${token}~${counter}`. */
export function redeemSolution(solution: string | null | undefined, minDifficulty: number): PowResult {
  if (!solution) return { ok: false, reason: "missing" };
  const [token, counter] = solution.split("~");
  if (!token || !counter || !/^\d{1,12}$/.test(counter)) return { ok: false, reason: "malformed" };
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return { ok: false, reason: "malformed" };
  const expected = crypto.createHmac("sha256", key()).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return { ok: false, reason: "bad_signature" };
  let data: { n: string; d: number; e: number };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const now = Date.now();
  if (data.e < now) return { ok: false, reason: "expired" };
  if (data.d < minDifficulty) return { ok: false, reason: "too_easy" };
  if (used.has(data.n)) return { ok: false, reason: "replayed" };
  const hash = crypto.createHash("sha256").update(`${token}:${counter}`).digest();
  if (leadingZeroBits(hash) < data.d) return { ok: false, reason: "wrong_solution" };
  used.set(data.n, data.e);
  if (used.size > 50_000) for (const [k, exp] of used) if (exp < now) used.delete(k);
  return { ok: true, difficulty: data.d };
}
