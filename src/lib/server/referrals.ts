import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences, referrals, user } from "@/lib/db/schema";
import { CREDITS } from "@/lib/config";
import { grantCredits } from "./credits";
import { newId, newReferralCode } from "./ids";

export async function ensureReferralCode(userId: string): Promise<string> {
  const [row] = await db.select({ code: user.referralCode }).from(user).where(eq(user.id, userId));
  if (row?.code) return row.code;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newReferralCode();
    try {
      const [updated] = await db
        .update(user)
        .set({ referralCode: code })
        .where(and(eq(user.id, userId), sql`${user.referralCode} is null`))
        .returning({ code: user.referralCode });
      if (updated?.code) return updated.code;
      const [again] = await db.select({ code: user.referralCode }).from(user).where(eq(user.id, userId));
      if (again?.code) return again.code;
    } catch {
      // unique collision — retry with a new code
    }
  }
  throw new Error("Could not allocate a referral code");
}

/**
 * Runs once for every new account (Better Auth database hook): preferences, referral code,
 * referral link. Free credits are NOT granted here; see decideBonuses (after email verification).
 */
export async function onUserCreated(userId: string, referralCode?: string | null) {
  await db.insert(preferences).values({ userId }).onConflictDoNothing();
  await ensureReferralCode(userId);
  if (referralCode) await attachReferral(userId, referralCode).catch((err) => console.error("[referral] attach failed", err));
}

const BONUS_REFUSED: Record<string, string> = {
  device_already_rewarded: "Free credits were already given to another account on this device.",
  hosting_network: "Free credits aren't available for accounts created through a VPN or hosting network.",
  subnet_quota: "Free credits were already given to several accounts on this network.",
  email_already_rewarded: "Free credits were already given to an earlier account with this email.",
};

export function bonusRefusalMessage(status: string | null) {
  return status && status !== "granted" ? (BONUS_REFUSED[status] ?? null) : null;
}

/**
 * Grants the welcome and referral credits exactly once, after the email address is verified
 * and only if the anti-abuse checks pass. Safe to call many times.
 */
export async function decideBonuses(userId: string) {
  const { bonusEligibility } = await import("./abuse/signup-guard");
  const verdict = await bonusEligibility(userId);
  if (!verdict.eligible && verdict.reason === "unverified") return { granted: false as const, reason: "unverified" };
  const status = verdict.eligible ? "granted" : verdict.reason;
  const [claimed] = await db
    .update(user)
    .set({ bonusDecidedAt: new Date(), bonusStatus: status })
    .where(and(eq(user.id, userId), sql`${user.bonusDecidedAt} is null`))
    .returning({ id: user.id });
  if (!claimed) return { granted: false as const, reason: "already_decided" };
  if (!verdict.eligible) return { granted: false as const, reason: verdict.reason };

  if (CREDITS.signupBonusMicros > 0) {
    await grantCredits({ userId, amountMicros: CREDITS.signupBonusMicros, type: "signup_bonus", description: "Welcome credits", reference: `signup:${userId}` });
  }
  const [ref] = await db.select().from(referrals).where(eq(referrals.refereeId, userId));
  if (ref && CREDITS.refereeRewardMicros > 0) {
    await grantCredits({ userId, amountMicros: CREDITS.refereeRewardMicros, type: "referee_bonus", description: "Referral welcome credits", reference: `referee:${ref.id}` });
  }
  return { granted: true as const };
}

export async function attachReferral(refereeId: string, code: string) {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(normalized)) return;
  const [referrer] = await db.select({ id: user.id }).from(user).where(eq(user.referralCode, normalized));
  if (!referrer || referrer.id === refereeId) return;

  const id = newId("ref");
  const inserted = await db
    .insert(referrals)
    .values({ id, referrerId: referrer.id, refereeId, rewardMicros: CREDITS.referrerRewardMicros })
    .onConflictDoNothing()
    .returning({ id: referrals.id });
  if (!inserted.length) return;

  await db.update(user).set({ referredBy: referrer.id }).where(eq(user.id, refereeId));
}

/** Called after a user's successful agent run. Rewards the referrer exactly once. */
export async function maybeRewardReferrer(refereeId: string) {
  // Only real, distinct people count: the friend must have passed the free-credit checks and
  // must not share a device or network with the referrer.
  const [referee] = await db.select({ status: user.bonusStatus, device: user.signupDevice, fp: user.signupFp, ip: user.signupIp, referrer: user.referredBy }).from(user).where(eq(user.id, refereeId));
  if (!referee?.referrer || referee.status !== "granted") return;
  const [referrer] = await db.select({ device: user.signupDevice, fp: user.signupFp, ip: user.signupIp }).from(user).where(eq(user.id, referee.referrer));
  const same = (a: string | null, b: string | null) => Boolean(a && b && a === b);
  const net = (ip: string | null) => ip?.split(".").slice(0, 3).join(".") ?? null;
  if (referrer && (same(referee.device, referrer.device) || same(referee.fp, referrer.fp) || same(net(referee.ip), net(referrer.ip)))) {
    await db.update(referrals).set({ status: "rewarded", rewardMicros: 0, rewardedAt: new Date() }).where(eq(referrals.refereeId, refereeId));
    return;
  }
  const [pending] = await db
    .update(referrals)
    .set({ status: "rewarded", rewardedAt: new Date() })
    .where(and(eq(referrals.refereeId, refereeId), eq(referrals.status, "pending")))
    .returning();
  if (!pending) return;
  const [named] = await db.select({ name: user.name }).from(user).where(eq(user.id, refereeId));
  await grantCredits({
    userId: pending.referrerId,
    amountMicros: pending.rewardMicros,
    type: "referral_bonus",
    description: `Referral reward: ${named?.name ?? "a friend"} finished their first build`,
    reference: `referral:${pending.id}`,
  });
}

export async function getReferralStats(userId: string) {
  const code = await ensureReferralCode(userId);
  const rows = await db
    .select({
      id: referrals.id,
      status: referrals.status,
      rewardMicros: referrals.rewardMicros,
      createdAt: referrals.createdAt,
      name: user.name,
    })
    .from(referrals)
    .innerJoin(user, eq(user.id, referrals.refereeId))
    .where(eq(referrals.referrerId, userId))
    .orderBy(sql`${referrals.createdAt} desc`);
  const earned = rows.filter((r) => r.status === "rewarded").reduce((s, r) => s + r.rewardMicros, 0);
  const pending = rows.filter((r) => r.status === "pending").length;
  return { code, referrals: rows, earnedMicros: earned, pendingCount: pending };
}
