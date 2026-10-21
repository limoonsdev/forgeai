import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { account } from "@/lib/db/schema";
import { requireUser } from "@/lib/server/session";
import { AccountView } from "@/components/settings/account-view";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  const [credential] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, user.id), eq(account.providerId, "credential")));
  return <AccountView user={{ name: user.name, email: user.email, image: user.image, createdAt: user.createdAt.toISOString() }} hasPassword={Boolean(credential)} />;
}
