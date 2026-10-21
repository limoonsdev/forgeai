import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences, skills } from "@/lib/db/schema";
import { BUILTIN_SKILLS } from "@/lib/skills";
import { requireUser } from "@/lib/server/session";
import { SkillsView } from "@/components/settings/skills-view";

export const metadata: Metadata = { title: "Skills" };

export default async function SkillsPage() {
  const user = await requireUser();
  const [prefs] = await db.select({ disabled: preferences.disabledSkills }).from(preferences).where(eq(preferences.userId, user.id));
  const disabled = new Set(prefs?.disabled ?? []);
  const own = await db.select().from(skills).where(eq(skills.userId, user.id)).orderBy(desc(skills.createdAt));
  return (
    <SkillsView
      builtin={BUILTIN_SKILLS.map((s) => ({ slug: s.slug, name: s.name, description: s.description, content: s.content, enabled: !disabled.has(s.slug) }))}
      custom={own.map((s) => ({ id: s.id, slug: s.slug, name: s.name, description: s.description, content: s.content, source: s.source, sourceUrl: s.sourceUrl, enabled: s.enabled }))}
    />
  );
}
