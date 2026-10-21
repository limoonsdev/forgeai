import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { errorResponse, json, readJson, withApi } from "@/lib/server/api";

type P = { id: string };

export const PATCH = withApi<P>(async (req, { auth, params }) => {
  const { enabled } = z.object({ enabled: z.boolean() }).parse(await readJson(req));
  const [row] = await db
    .update(skills)
    .set({ enabled, updatedAt: new Date() })
    .where(and(eq(skills.id, params.id), eq(skills.userId, auth.userId)))
    .returning();
  return row ? json({ skill: row }) : errorResponse(404, "not_found", "Skill not found");
});

export const DELETE = withApi<P>(async (_req, { auth, params }) => {
  const rows = await db.delete(skills).where(and(eq(skills.id, params.id), eq(skills.userId, auth.userId))).returning({ id: skills.id });
  return rows.length ? json({ deleted: true }) : errorResponse(404, "not_found", "Skill not found");
});
