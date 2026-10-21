import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences, skills } from "@/lib/db/schema";
import { BUILTIN_SKILLS, createSkill, fetchSkillFromUrl } from "@/lib/skills";
import { json, readJson, withApi } from "@/lib/server/api";

export const GET = withApi(async (_req, { auth }) => {
  const [prefs] = await db.select({ disabled: preferences.disabledSkills }).from(preferences).where(eq(preferences.userId, auth.userId));
  const disabled = new Set(prefs?.disabled ?? []);
  const own = await db.select().from(skills).where(eq(skills.userId, auth.userId)).orderBy(desc(skills.createdAt));
  return json({
    builtin: BUILTIN_SKILLS.map((s) => ({ slug: s.slug, name: s.name, description: s.description, content: s.content, enabled: !disabled.has(s.slug) })),
    custom: own,
  });
});

const Body = z.discriminatedUnion("source", [
  z.object({ source: z.literal("paste"), content: z.string().min(1).max(100_000) }),
  z.object({ source: z.literal("upload"), content: z.string().min(1).max(100_000), filename: z.string().max(200).optional() }),
  z.object({ source: z.literal("url"), url: z.string().url().max(500) }),
]);

/** Import a skill (SKILL.md) by pasting it, uploading a file or linking to it. */
export const POST = withApi(async (req, { auth }) => {
  const body = Body.parse(await readJson(req));
  if (body.source === "url") {
    const { text, url } = await fetchSkillFromUrl(body.url);
    return json({ skill: await createSkill(auth.userId, text, "url", url) }, { status: 201 });
  }
  return json({ skill: await createSkill(auth.userId, body.content, body.source) }, { status: 201 });
});
