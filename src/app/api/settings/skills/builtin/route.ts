import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences } from "@/lib/db/schema";
import { BUILTIN_SKILLS } from "@/lib/skills";
import { json, readJson, withApi } from "@/lib/server/api";

/** Enable or disable one of the built-in skills. */
export const PATCH = withApi(async (req, { auth }) => {
  const { slug, enabled } = z
    .object({ slug: z.string().refine((s) => BUILTIN_SKILLS.some((b) => b.slug === s), "Unknown skill"), enabled: z.boolean() })
    .parse(await readJson(req));
  await db.insert(preferences).values({ userId: auth.userId }).onConflictDoNothing();
  const [prefs] = await db.select({ disabled: preferences.disabledSkills }).from(preferences).where(eq(preferences.userId, auth.userId));
  const set = new Set(prefs?.disabled ?? []);
  if (enabled) set.delete(slug);
  else set.add(slug);
  await db.update(preferences).set({ disabledSkills: [...set], updatedAt: new Date() }).where(eq(preferences.userId, auth.userId));
  return json({ slug, enabled });
});
