import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { json, withApi, errorResponse } from "@/lib/server/api";

export const GET = withApi(async (_req, { auth }) => {
  const [u] = await db.select().from(user).where(eq(user.id, auth.userId));
  if (!u) return errorResponse(404, "not_found", "User not found");
  return json({
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    plan: u.plan,
    credits: { balanceMicros: u.creditsMicros, balanceUsd: u.creditsMicros / 1_000_000 },
    referralCode: u.referralCode,
    createdAt: u.createdAt,
  });
});
