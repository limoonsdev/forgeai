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
 * Runs once for every new account (Better Auth database hook).
 * Grants the sign-up bonus, creates preferences, a referral code, and links the referrer if any.
 */
export async function onUserCreated(userId: string, referralCode?: string | null) {
  await db.insert(preferences).values({ userId }).onConflictDoNothing();
  await ensureReferralCode(userId);

  if (CREDITS.signupBonusMicros > 0) {
    await grantCredits({
      userId,
      amountMicros: CREDITS.signupBonusMicros,
      type: "signup_bonus",
      description: "Welcome to Forged.dev 🔥",
      reference: `signup:${userId}`,
    });
  }

  if (referralCode) {
    await attachReferral(userId, referralCode).catch((err) => console.error("[referral] attach failed", err));
  }
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
  if (CREDITS.refereeRewardMicros > 0) {
    await grantCredits({
      userId: refereeId,
      amountMicros: CREDITS.refereeRewardMicros,
      type: "referee_bonus",
      description: "Referral welcome credits",
      reference: `referee:${id}`,
    });
  }
}

/** Called after a user's successful agent run. Rewards the referrer exactly once. */
export async function maybeRewardReferrer(refereeId: string) {
  const [pending] = await db
    .update(referrals)
    .set({ status: "rewarded", rewardedAt: new Date() })
    .where(and(eq(referrals.refereeId, refereeId), eq(referrals.status, "pending")))
    .returning();
  if (!pending) return;
  const [referee] = await db.select({ name: user.name }).from(user).where(eq(user.id, refereeId));
  await grantCredits({
    userId: pending.referrerId,
    amountMicros: pending.rewardMicros,
    type: "referral_bonus",
    description: `Referral reward: ${referee?.name ?? "a friend"} finished their first build`,
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
