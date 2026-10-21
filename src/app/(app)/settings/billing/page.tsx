import type { Metadata } from "next";
import { Suspense } from "react";
import { CREDIT_PACKS, PLANS } from "@/lib/config";
import { getRecentUsage, listTransactions } from "@/lib/server/credits";
import { requireUser } from "@/lib/server/session";
import { billingEnabled } from "@/lib/server/stripe";
import { BillingView } from "@/components/settings/billing-view";

export const metadata: Metadata = { title: "Credits & billing" };

export default async function BillingPage() {
  const user = await requireUser();
  const transactions = await listTransactions(user.id, 100);
  const usage30d = await getRecentUsage(user.id, 30);
  return (
    <Suspense>
      <BillingView
        balance={user.creditsMicros}
        plan={user.plan}
        renewsAt={user.planRenewsAt?.toISOString() ?? null}
        billingEnabled={billingEnabled()}
        usage30d={usage30d}
        plans={PLANS.map(({ id, name, priceUsd, monthlyCreditsUsd, tagline, features, highlighted }) => ({ id, name, priceUsd, monthlyCreditsUsd, tagline, features, highlighted }))}
        packs={[...CREDIT_PACKS]}
        transactions={transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amountMicros: t.amountMicros,
          balanceAfterMicros: t.balanceAfterMicros,
          description: t.description,
          createdAt: t.createdAt.toISOString(),
        }))}
      />
    </Suspense>
  );
}
