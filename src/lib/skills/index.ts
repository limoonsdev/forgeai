import "server-only";
import YAML from "yaml";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences, skills } from "@/lib/db/schema";
import { slugify } from "@/lib/utils";
import { BUILTIN_SKILLS, type SkillDoc } from "./builtin";

export const MAX_SKILL_BYTES = 100 * 1024;

export class SkillError extends Error {}

/** Parses a SKILL.md (YAML front matter with name/description + markdown body). */
export function parseSkillMarkdown(raw: string, fallbackName?: string): { name: string; description: string; content: string } {
  const text = raw.replace(/^﻿/, "").trim();
  if (!text) throw new SkillError("The skill file is empty.");
  if (Buffer.byteLength(text, "utf8") > MAX_SKILL_BYTES) throw new SkillError("Skills are limited to 100 KB.");
  let name = fallbackName ?? "";
  let description = "";
  let body = text;
  const fm = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (fm) {
    try {
      const meta = (YAML.parse(fm[1]) ?? {}) as Record<string, unknown>;
      if (typeof meta.name === "string") name = meta.name;
      if (typeof meta.description === "string") description = meta.description;
    } catch {
      throw new SkillError("Invalid YAML front matter.");
    }
    body = fm[2].trim();
  }
  if (!name) {
    const h1 = body.match(/^#\s+(.+)$/m);
    name = h1?.[1] ?? "imported-skill";
  }
  if (!description) {
    description = body.replace(/^#.*$/gm, "").trim().split("\n").find((l) => l.trim())?.slice(0, 200) ?? "";
  }
  return { name: name.trim().slice(0, 80), description: description.trim().slice(0, 500), content: body };
}

const ALLOWED_HOSTS = new Set(["github.com", "raw.githubusercontent.com", "gist.githubusercontent.com", "gitlab.com", "huggingface.co", "bitbucket.org"]);

export async function fetchSkillFromUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new SkillError("Invalid URL.");
  }
  if (url.protocol !== "https:") throw new SkillError("Only https URLs are supported.");
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new SkillError(`Skills can be imported from ${[...ALLOWED_HOSTS].join(", ")}.`);
  // github.com/<owner>/<repo>/blob/<ref>/<path> → raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>
  if (url.hostname === "github.com") {
    const m = url.pathname.match(/^\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/);
    if (!m) throw new SkillError("Link to a SKILL.md file (…/blob/main/path/SKILL.md).");
    url = new URL(`https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`);
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: "error" });
  if (!res.ok) throw new SkillError(`Could not download the skill (HTTP ${res.status}).`);
  const text = await res.text();
  return { text, url: url.toString() };
}

export async function createSkill(userId: string, raw: string, source: "paste" | "upload" | "url", sourceUrl?: string) {
  const parsed = parseSkillMarkdown(raw);
  let slug = slugify(parsed.name) || "skill";
  if (BUILTIN_SKILLS.some((b) => b.slug === slug)) slug = `${slug}-custom`;
  const id = `skl_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const [row] = await db
    .insert(skills)
    .values({ id, userId, slug, name: parsed.name, description: parsed.description, content: parsed.content, source, sourceUrl })
    .onConflictDoUpdate({
      target: [skills.userId, skills.slug],
      set: { name: parsed.name, description: parsed.description, content: parsed.content, source, sourceUrl, updatedAt: new Date() },
    })
    .returning();
  return row;
}

async function connectorSkills(userId: string): Promise<SkillDoc[]> {
  const { connectorContext } = await import("@/lib/connectors");
  const { defs } = await connectorContext(userId);
  return defs.filter((d) => d.skill).map((d) => ({ slug: `connector-${d.id}`, name: `connector-${d.id}`, description: `How to use ${d.name} (connected) in this app.`, content: d.skill, builtin: true }));
}

export async function getEnabledSkills(userId: string): Promise<SkillDoc[]> {
  const [prefs] = await db.select({ disabled: preferences.disabledSkills }).from(preferences).where(eq(preferences.userId, userId));
  const disabled = new Set(prefs?.disabled ?? []);
  const own = await db
    .select({ slug: skills.slug, name: skills.name, description: skills.description, content: skills.content })
    .from(skills)
    .where(and(eq(skills.userId, userId), eq(skills.enabled, true)));
  return [...BUILTIN_SKILLS.filter((s) => !disabled.has(s.slug)).map((s) => ({ ...s, builtin: true })), ...(await connectorSkills(userId)), ...own];
}

export async function findSkill(userId: string, nameOrSlug: string) {
  const all = await getEnabledSkills(userId);
  const key = nameOrSlug.trim().toLowerCase();
  return all.find((s) => s.slug === key || s.name.toLowerCase() === key || slugify(s.name) === slugify(key)) ?? null;
}

export { BUILTIN_SKILLS };
