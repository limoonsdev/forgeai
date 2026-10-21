import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { listModels } from "@/lib/ai/catalog";
import type { PlanId } from "@/lib/config";
import { json, withApi } from "@/lib/server/api";

export const GET = withApi(async (_req, { auth }) => {
  const [u] = await db.select({ plan: user.plan }).from(user).where(eq(user.id, auth.userId));
  return json({ models: await listModels((u?.plan ?? "free") as PlanId) });
});
