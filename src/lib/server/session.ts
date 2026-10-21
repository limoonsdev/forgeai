import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** Current user row (with credits/plan) or null. */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const [row] = await db.select().from(user).where(eq(user.id, session.user.id));
  return row ?? null;
});

export async function requireUser(redirectTo = "/login") {
  const u = await getCurrentUser();
  if (!u) redirect(redirectTo);
  return u;
}
