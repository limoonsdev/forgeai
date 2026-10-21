import "server-only";
import crypto from "node:crypto";
import { and, count, eq, gte, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { creditTransactions, signupAttempts, user } from "@/lib/db/schema";
import { newId } from "@/lib/server/ids";
import { domainAcceptsMail, emailHash, isDisposable } from "./email";
import { isBannedIp, isPrivateOrLocal, lookupAsn, subnetOf } from "./network";
import { redeemSolution } from "./pow";

/**
 * Sign-up abuse policy. Each layer catches what the previous one misses:
 *  - proof of work: every attempt costs CPU, more when the network or device looks busy
 *  - device: a random id kept in cookie + localStorage + IndexedDB, plus browser fingerprints
 *    that survive private windows, VPNs and IP changes
 *  - network: per-IP, per-/24 (or /48) and per-ASN limits; hosting/VPN networks are throttled
 *  - email: disposable domains, undeliverable domains and alias farming (gmail dots, +tags)
 *  - credits: free credits are only granted after email verification, once per device/person
 * MAC addresses never reach a web server, so they cannot be (and need not be) checked.
 */

export const DEVICE_COOKIE = "forged_did";
export const FP_COOKIE = "forged_fp";
export const POW_COOKIE = "forged_pow";

const num = (k: string, d: number) => {
  const v = Number(process.env[k]);
  return Number.isFinite(v) && process.env[k] ? v : d;
};
const LIMITS = {
  ipDay: num("FORGED_SIGNUP_PER_IP_DAY", 2),
  ipWeek: num("FORGED_SIGNUP_PER_IP_WEEK", 4),
  subnetDay: num("FORGED_SIGNUP_PER_SUBNET_DAY", 4),
  deviceMonth: num("FORGED_SIGNUP_PER_DEVICE_MONTH", 2),
  fpDay: num("FORGED_SIGNUP_PER_FINGERPRINT_DAY", 2),
  fpMonth: num("FORGED_SIGNUP_PER_FINGERPRINT_MONTH", 4),
  hostingAsnHour: num("FORGED_SIGNUP_PER_HOSTING_ASN_HOUR", 3),
  globalTenMinutes: num("FORGED_SIGNUP_SURGE_10MIN", 40),
  bonusPerSubnetMonth: num("FORGED_BONUS_PER_SUBNET_MONTH", 3),
};

export function enforcing() {
  return process.env.NODE_ENV === "production" || process.env.FORGED_ENFORCE_SIGNUP_LIMITS === "1";
}

export type SignupSignals = {
  ip: string;
  subnet: string;
  asn: string | null;
  hosting: boolean;
  device: string | null;
  fp: string | null;
  hw: string | null;
  pow: string | null;
};

function keyed(kind: string, value: string | null | undefined, max = 128) {
  if (!value || value.length > max || !/^[\w.:-]+$/.test(value)) return null;
  const secret = process.env.BETTER_AUTH_SECRET ?? "dev";
  return crypto.createHmac("sha256", secret).update(`${kind}:${value}`).digest("hex").slice(0, 32);
}

function cookie(header: string | null, name: string) {
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) {
      try {
        return decodeURIComponent(part.slice(i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Collects every signal from the request. Raw identifiers are never stored, only keyed hashes. */
export function readSignals(headers: Headers, ip: string): SignupSignals {
  const cookies = headers.get("cookie");
  const fpRaw = cookie(cookies, FP_COOKIE) ?? "";
  const [fp, hw] = fpRaw.split(".");
  const asn = lookupAsn(ip);
  return {
    ip,
    subnet: subnetOf(ip),
    asn: asn?.asn ?? null,
    hosting: asn?.hosting ?? false,
    device: keyed("did", cookie(cookies, DEVICE_COOKIE), 64),
    fp: keyed("fp", fp, 64),
    hw: keyed("hw", hw, 64),
    pow: cookie(cookies, POW_COOKIE),
  };
}

async function countSince(where: ReturnType<typeof and>, sinceMs: number) {
  const [row] = await db
    .select({ n: count() })
    .from(signupAttempts)
    .where(and(where, gte(signupAttempts.createdAt, new Date(Date.now() - sinceMs))));
  return row?.n ?? 0;
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Proof-of-work difficulty in bits (20 ≈ 0.5 s on a laptop, 1–2 s on a phone; each +1 doubles the work). */
export async function challengeDifficulty(s: SignupSignals) {
  if (!enforcing()) return 12;
  let d = num("FORGED_POW_BASE_BITS", 20);
  const [ipRecent, subnetRecent, surge] = await Promise.all([
    countSince(eq(signupAttempts.ip, s.ip), DAY),
    countSince(eq(signupAttempts.subnet, s.subnet), DAY),
    countSince(sql`true`, 10 * 60_000),
  ]);
  if (ipRecent > 0) d += 2;
  if (subnetRecent >= 2) d += 2;
  if (s.hosting) d += 3;
  if (surge >= LIMITS.globalTenMinutes) d += 3;
  return Math.min(d, 24);
}

export type SignupVerdict = { ok: true } | { ok: false; reason: string; message: string };

const deny = (reason: string, message: string): SignupVerdict => ({ ok: false, reason, message });
const TOO_MANY = "Too many accounts were created from this network or device recently. Please try again later or contact support.";

export async function checkSignup(s: SignupSignals, email: string, method: "email" | "oauth"): Promise<SignupVerdict> {
  if (await isBannedIp(s.ip)) return deny("ip_banned", "Sign-ups from this network are blocked.");

  if (method === "email") {
    if (isDisposable(email)) return deny("disposable_email", "Please use a permanent email address. Temporary inboxes can't be used.");
    if (!(await domainAcceptsMail(email))) return deny("undeliverable_email", "This email domain can't receive mail. Check the address.");
  }
  const [aliasUsed] = await db.select({ id: user.id }).from(user).where(eq(user.emailKey, emailHash(email))).limit(1);
  if (aliasUsed) return deny("email_alias", "An account already exists for this mailbox. Log in instead.");

  if (!enforcing()) return { ok: true };

  // Proof of work is mandatory for email sign-ups. OAuth providers run their own abuse checks
  // and some (Apple) post back cross-site without our cookies, so it is optional there.
  if (method === "email" || s.pow) {
    const min = Math.max(12, (await challengeDifficulty(s)) - 4);
    const pow = redeemSolution(s.pow, min);
    if (!pow.ok) return deny(`pow_${pow.reason}`, "The security check didn't complete. Reload the page and try again.");
  }
  if (method === "email" && !s.fp) return deny("no_fingerprint", "The security check didn't complete. Reload the page and try again.");

  const created = eq(signupAttempts.outcome, "created");
  const checks: [Promise<number>, number, string][] = [
    [countSince(and(created, eq(signupAttempts.ip, s.ip)), DAY), LIMITS.ipDay, "ip_day"],
    [countSince(and(created, eq(signupAttempts.ip, s.ip)), 7 * DAY), LIMITS.ipWeek, "ip_week"],
    [countSince(and(created, eq(signupAttempts.subnet, s.subnet)), DAY), LIMITS.subnetDay, "subnet_day"],
  ];
  if (s.device) checks.push([countSince(and(created, eq(signupAttempts.device, s.device)), 30 * DAY), LIMITS.deviceMonth, "device_month"]);
  if (s.fp) {
    checks.push([countSince(and(created, eq(signupAttempts.fp, s.fp)), DAY), LIMITS.fpDay, "fp_day"]);
    checks.push([countSince(and(created, eq(signupAttempts.fp, s.fp)), 30 * DAY), LIMITS.fpMonth, "fp_month"]);
  }
  if (s.hosting && s.asn) checks.push([countSince(and(created, eq(signupAttempts.asn, s.asn)), HOUR), LIMITS.hostingAsnHour, "hosting_asn_hour"]);
  const counts = await Promise.all(checks.map(([p]) => p));
  for (let i = 0; i < checks.length; i++) if (counts[i] >= checks[i][1]) return deny(checks[i][2], TOO_MANY);
  return { ok: true };
}

export async function recordAttempt(s: SignupSignals, email: string | null, method: "email" | "oauth", outcome: string) {
  await db
    .insert(signupAttempts)
    .values({
      id: newId("sa"),
      ip: isPrivateOrLocal(s.ip) && enforcing() ? "local" : s.ip,
      subnet: s.subnet,
      device: s.device,
      fp: s.fp,
      hw: s.hw,
      asn: s.asn,
      hosting: s.hosting,
      emailHash: email ? emailHash(email) : null,
      method,
      outcome: outcome.slice(0, 60),
    })
    .catch((err) => console.warn("[abuse] could not record attempt", (err as Error).message));
}

/**
 * Free credits (welcome + referral) are granted once per person: the account must be verified,
 * not created from a hosting/VPN network, and no other account on the same device or browser
 * fingerprint may have received them.
 */
export async function bonusEligibility(userId: string): Promise<{ eligible: true } | { eligible: false; reason: string }> {
  const [u] = await db
    .select({ verified: user.emailVerified, device: user.signupDevice, fp: user.signupFp, ip: user.signupIp, hosting: user.signupHosting, emailKey: user.emailKey })
    .from(user)
    .where(eq(user.id, userId));
  if (!u) return { eligible: false, reason: "not_found" };
  if (!u.verified) return { eligible: false, reason: "unverified" };
  if (!enforcing()) return { eligible: true };
  if (u.emailKey) {
    // Deleting an account and signing up again with the same mailbox doesn't renew free credits.
    const [prev] = await db.select({ n: count() }).from(signupAttempts).where(and(eq(signupAttempts.emailHash, u.emailKey), eq(signupAttempts.outcome, "created")));
    if ((prev?.n ?? 0) > 1) return { eligible: false, reason: "email_already_rewarded" };
  }
  if (u.hosting) return { eligible: false, reason: "hosting_network" };
  const sameDevice = [u.device ? eq(user.signupDevice, u.device) : null, u.fp ? eq(user.signupFp, u.fp) : null].filter(Boolean) as ReturnType<typeof eq>[];
  if (sameDevice.length) {
    const siblings = await db
      .select({ id: user.id })
      .from(user)
      .where(and(ne(user.id, userId), or(...sameDevice)))
      .limit(50);
    if (siblings.length) {
      const [rewarded] = await db
        .select({ id: creditTransactions.id })
        .from(creditTransactions)
        .where(and(inArray(creditTransactions.userId, siblings.map((x) => x.id)), inArray(creditTransactions.type, ["signup_bonus", "referee_bonus"])))
        .limit(1);
      if (rewarded) return { eligible: false, reason: "device_already_rewarded" };
    }
  }
  if (u.ip) {
    const [row] = await db
      .select({ n: count() })
      .from(user)
      .innerJoin(creditTransactions, and(eq(creditTransactions.userId, user.id), eq(creditTransactions.type, "signup_bonus")))
      .where(and(ne(user.id, userId), isNotNull(user.signupIp), sql`split_part(${user.signupIp}, '.', 1) || '.' || split_part(${user.signupIp}, '.', 2) || '.' || split_part(${user.signupIp}, '.', 3) = split_part(${u.ip}, '.', 1) || '.' || split_part(${u.ip}, '.', 2) || '.' || split_part(${u.ip}, '.', 3)`, gte(creditTransactions.createdAt, new Date(Date.now() - 30 * DAY))));
    if ((row?.n ?? 0) >= LIMITS.bonusPerSubnetMonth) return { eligible: false, reason: "subnet_quota" };
  }
  return { eligible: true };
}
