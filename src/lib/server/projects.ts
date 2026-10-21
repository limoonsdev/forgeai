import "server-only";
import JSZip from "jszip";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, projectFiles, projects, type Project } from "@/lib/db/schema";
import { stopSandbox } from "@/lib/sandbox";
import { getActiveRun, stopRun } from "@/lib/ai/run-registry";
import { getAllFiles } from "./files";
import { ApiError } from "./api";
import { newId, newSecretToken } from "./ids";
import { loadTemplateFiles } from "./template";

export function serializeProject(p: Project) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    model: p.model,
    tokenSaver: p.tokenSaver,
    share: { enabled: p.shareEnabled, token: p.shareEnabled ? p.shareToken : null, allowRemix: p.shareAllowRemix },
    sandbox: { status: p.sandboxStatus, previewUrl: p.previewUrl, provider: p.sandboxProvider },
    totalCostMicros: p.totalCostMicros,
    forkedFromId: p.forkedFromId,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
export type ProjectDTO = ReturnType<typeof serializeProject>;

const MAX_PROJECTS = Number(process.env.FORGED_MAX_PROJECTS_PER_USER || 200);

export async function createProject(userId: string, input: { name?: string; description?: string; model?: string; tokenSaver?: boolean | null }) {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(projects).where(eq(projects.userId, userId));
  if (count >= MAX_PROJECTS) throw new ApiError(409, "project_limit", `You've reached ${MAX_PROJECTS} projects. Delete old ones to create more.`);
  const id = newId();
  const [project] = await db
    .insert(projects)
    .values({
      id,
      userId,
      name: input.name?.trim().slice(0, 60) || "Untitled project",
      description: input.description?.trim().slice(0, 300) ?? "",
      model: input.model ?? null,
      tokenSaver: input.tokenSaver ?? null,
    })
    .returning();
  const template = await loadTemplateFiles();
  await db.insert(projectFiles).values(template.map((f) => ({ projectId: id, path: f.path, content: f.content })));
  return project;
}

export async function getOwnedProject(userId: string, projectId: string) {
  const [p] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  return p ?? null;
}

export async function listProjects(userId: string, limit = 100) {
  return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.updatedAt)).limit(limit);
}

export async function updateProject(
  userId: string,
  projectId: string,
  patch: { name?: string; description?: string; model?: string | null; tokenSaver?: boolean | null },
) {
  const values: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) values.name = patch.name.trim().slice(0, 60) || "Untitled project";
  if (patch.description !== undefined) values.description = patch.description.trim().slice(0, 300);
  if (patch.model !== undefined) values.model = patch.model;
  if (patch.tokenSaver !== undefined) values.tokenSaver = patch.tokenSaver;
  const [p] = await db
    .update(projects)
    .set(values)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .returning();
  return p ?? null;
}

export async function deleteProject(userId: string, projectId: string) {
  const p = await getOwnedProject(userId, projectId);
  if (!p) return false;
  if (getActiveRun(projectId)) stopRun(projectId);
  await stopSandbox(projectId).catch(() => {});
  await db.delete(projects).where(eq(projects.id, projectId));
  return true;
}

/** Session sharing: enable/disable a public read-only link. */
export async function setSharing(userId: string, projectId: string, input: { enabled: boolean; allowRemix?: boolean; regenerate?: boolean }) {
  const p = await getOwnedProject(userId, projectId);
  if (!p) return null;
  const token = !p.shareToken || input.regenerate ? newSecretToken() : p.shareToken;
  const [updated] = await db
    .update(projects)
    .set({ shareEnabled: input.enabled, shareToken: token, shareAllowRemix: input.allowRemix ?? p.shareAllowRemix })
    .where(eq(projects.id, projectId))
    .returning();
  return updated;
}

export async function getSharedProject(token: string) {
  if (!token || token.length < 16) return null;
  const [p] = await db.select().from(projects).where(and(eq(projects.shareToken, token), eq(projects.shareEnabled, true)));
  return p ?? null;
}

/** Remix: copy the files (not the conversation) of a project into a new project owned by `userId`. */
export async function forkProject(userId: string, source: Project) {
  const id = newId();
  const [project] = await db
    .insert(projects)
    .values({
      id,
      userId,
      name: `${source.name} (remix)`.slice(0, 60),
      description: source.description,
      model: source.model,
      forkedFromId: source.id,
    })
    .returning();
  const files = await getAllFiles(source.id);
  if (files.length) await db.insert(projectFiles).values(files.map((f) => ({ projectId: id, path: f.path, content: f.content })));
  return project;
}

export async function exportProjectZip(projectId: string, name: string) {
  const zip = new JSZip();
  const folder = zip.folder(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "forged-app")!;
  for (const f of await getAllFiles(projectId)) folder.file(f.path, f.content);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export async function countMessages(projectId: string) {
  const rows = await db.select({ id: messages.id }).from(messages).where(eq(messages.projectId, projectId));
  return rows.length;
}
