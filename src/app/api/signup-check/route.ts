import { challengeDifficulty, readSignals } from "@/lib/server/abuse/signup-guard";
import { issueChallenge } from "@/lib/server/abuse/pow";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp, errorResponse, json } from "@/lib/server/api";

/** Issues a proof-of-work challenge for the sign-up form (difficulty depends on recent activity). */
export async function GET(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`signup-challenge:${ip}`, 30, 10 * 60_000);
  if (!rl.ok) return errorResponse(429, "rate_limited", "Too many attempts. Wait a few minutes and try again.", { "Retry-After": String(rl.retryAfter) });
  const difficulty = await challengeDifficulty(readSignals(req.headers, ip));
  return json(issueChallenge(difficulty), { headers: { "Cache-Control": "no-store" } });
}
