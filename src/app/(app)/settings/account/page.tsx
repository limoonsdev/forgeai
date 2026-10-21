import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { account } from "@/lib/db/schema";
import { enabledSocialProviders } from "@/lib/auth";
import { bonusRefusalMessage } from "@/lib/server/referrals";
import { requireUser } from "@/lib/server/session";
import { AccountView } from "@/components/settings/account-view";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  const [credential] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, user.id), eq(account.providerId, "credential")));
  return (
    <AccountView
      user={{ name: user.name, email: user.email, emailVerified: user.emailVerified, image: user.image, createdAt: user.createdAt.toISOString(), username: user.username }}
      hasPassword={Boolean(credential)}
      enabledProviders={enabledSocialProviders}
      bonusMessage={bonusRefusalMessage(user.bonusStatus)}
    />
  );
}
