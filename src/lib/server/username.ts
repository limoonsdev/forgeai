import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

/** Usernames appear in published URLs (username-project.domain), so they follow DNS label rules. */
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])$/;

const RESERVED = new Set(
  "admin administrator root system support help security abuse billing api app apps www mail email smtp ftp ns dns status docs blog news forged forge staff team owner moderator mod legal privacy terms login signup auth oauth account settings dashboard preview deploy p cdn static assets null undefined test".split(
    " ",
  ),
);

export function usernameProblem(name: string): string | null {
  if (!USERNAME_RE.test(name)) return "3 to 24 characters: lowercase letters, numbers and dashes, not starting or ending with a dash.";
  if (name.includes("--")) return "Use single dashes only.";
  if (RESERVED.has(name)) return "This username is reserved.";
  return null;
}

function slugify(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 18)
    .replace(/-+$/, "");
}

export async function generateUsername(name: string, email: string) {
  let base = slugify(name) || slugify(email.split("@")[0]) || "maker";
  if (base.length < 3) base = `${base}-dev`.slice(0, 18);
  if (RESERVED.has(base)) base = `${base}-1`;
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${Math.floor(Math.random() * 9000 + 1000)}`;
    if (usernameProblem(candidate)) continue;
    const [taken] = await db.select({ id: user.id }).from(user).where(eq(user.username, candidate)).limit(1);
    if (!taken) return candidate;
  }
  return `maker-${Date.now().toString(36)}`;
}
