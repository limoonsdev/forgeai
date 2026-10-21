import type { Metadata } from "next";
import { CREDITS } from "@/lib/config";
import { getReferralStats } from "@/lib/server/referrals";
import { requireUser } from "@/lib/server/session";
import { absoluteUrl } from "@/lib/utils";
import { ReferralsView } from "@/components/settings/referrals-view";

export const metadata: Metadata = { title: "Referrals" };

export default async function ReferralsPage() {
  const user = await requireUser();
  const stats = await getReferralStats(user.id);
  return (
    <ReferralsView
      code={stats.code}
      link={absoluteUrl(`/r/${stats.code}`)}
      earned={stats.earnedMicros}
      pending={stats.pendingCount}
      rewardUsd={CREDITS.referrerRewardMicros / 1_000_000}
      referrals={stats.referrals.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
    />
  );
}
