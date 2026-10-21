import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { projectAssets, projectFiles, projects } from "@/lib/db/schema";
import { safeRelativePath, syncToSandbox } from "@/lib/sandbox";

export const MAX_FILE_BYTES = 512 * 1024;
export const MAX_FILES = 1500;

export class FileError extends Error {}

export function assertPath(p: string) {
  const safe = safeRelativePath(p);
  if (!safe) throw new FileError(`Invalid path "${p}". Use a project-relative path like app/page.tsx.`);
  return safe;
}

export async function listFiles(projectId: string) {
  const text = await db
    .select({ path: projectFiles.path, size: sql<number>`length(${projectFiles.content})`, updatedAt: projectFiles.updatedAt })
    .from(projectFiles)
    .where(eq(projectFiles.projectId, projectId))
    .orderBy(asc(projectFiles.path));
  const assets = await db
    .select({ path: projectAssets.path, size: projectAssets.size, updatedAt: projectAssets.updatedAt })
    .from(projectAssets)
    .where(eq(projectAssets.projectId, projectId));
  return [...text.map((f) => ({ ...f, binary: false })), ...assets.map((a) => ({ ...a, binary: true }))].sort((a, b) => a.path.localeCompare(b.path));
}

export const MAX_ASSET_BYTES = 50 * 1024 * 1024;
export const MAX_PROJECT_ASSET_BYTES = 200 * 1024 * 1024;

/** Binary files (generated media, imported images) live next to the code and are synced to the VM. */
export async function writeAsset(projectId: string, path: string, data: Buffer, mime: string) {
  const safe = assertPath(path);
  if (data.length > MAX_ASSET_BYTES) throw new FileError(`${safe} is larger than 50 MB.`);
  const [{ total }] = await db
    .select({ total: sql<number>`coalesce(sum(${projectAssets.size}), 0)::bigint` })
    .from(projectAssets)
    .where(eq(projectAssets.projectId, projectId));
  if (Number(total) + data.length > MAX_PROJECT_ASSET_BYTES) throw new FileError("Project media storage is full (200 MB).");
  await db
    .insert(projectAssets)
    .values({ projectId, path: safe, data, mime, size: data.length })
    .onConflictDoUpdate({ target: [projectAssets.projectId, projectAssets.path], set: { data, mime, size: data.length, updatedAt: new Date() } });
  await touchProject(projectId);
  await syncToSandbox(projectId, { binary: [{ path: safe, base64: data.toString("base64") }] });
  return safe;
}

export async function readAsset(projectId: string, path: string) {
  const safe = assertPath(path);
  const [row] = await db
    .select({ data: projectAssets.data, mime: projectAssets.mime })
    .from(projectAssets)
    .where(and(eq(projectAssets.projectId, projectId), eq(projectAssets.path, safe)));
  return row ?? null;
}

export async function getAllAssets(projectId: string) {
  return db.select({ path: projectAssets.path, data: projectAssets.data, mime: projectAssets.mime }).from(projectAssets).where(eq(projectAssets.projectId, projectId));
}

export async function getAllFiles(projectId: string) {
  return db
    .select({ path: projectFiles.path, content: projectFiles.content })
    .from(projectFiles)
    .where(eq(projectFiles.projectId, projectId))
    .orderBy(asc(projectFiles.path));
}

export async function readFile(projectId: string, path: string) {
  const safe = assertPath(path);
  const [row] = await db
    .select({ content: projectFiles.content })
    .from(projectFiles)
    .where(and(eq(projectFiles.projectId, projectId), eq(projectFiles.path, safe)));
  return row?.content ?? null;
}

async function touchProject(projectId: string) {
  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));
}

export async function writeFiles(projectId: string, files: { path: string; content: string }[], opts: { sync?: boolean } = {}) {
  const rows = files.map((f) => {
    const safe = assertPath(f.path);
    if (Buffer.byteLength(f.content, "utf8") > MAX_FILE_BYTES) throw new FileError(`${safe} is larger than 512 KB.`);
    return { projectId, path: safe, content: f.content, updatedAt: new Date() };
  });
  if (!rows.length) return [];
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectFiles)
    .where(eq(projectFiles.projectId, projectId));
  if (count + rows.length > MAX_FILES) throw new FileError(`Project file limit reached (${MAX_FILES} files).`);
  await db
    .insert(projectFiles)
    .values(rows)
    .onConflictDoUpdate({
      target: [projectFiles.projectId, projectFiles.path],
      set: { content: sql`excluded.content`, updatedAt: sql`excluded.updated_at` },
    });
  await touchProject(projectId);
  if (opts.sync !== false) await syncToSandbox(projectId, { write: rows.map((r) => ({ path: r.path, content: r.content })) });
  return rows.map((r) => r.path);
}

export async function writeFile(projectId: string, path: string, content: string) {
  const [p] = await writeFiles(projectId, [{ path, content }]);
  return p;
}

export async function deleteFile(projectId: string, path: string) {
  const safe = assertPath(path);
  let deleted = await db
    .delete(projectFiles)
    .where(and(eq(projectFiles.projectId, projectId), eq(projectFiles.path, safe)))
    .returning({ path: projectFiles.path });
  if (!deleted.length)
    deleted = await db
      .delete(projectAssets)
      .where(and(eq(projectAssets.projectId, projectId), eq(projectAssets.path, safe)))
      .returning({ path: projectAssets.path });
  if (!deleted.length) throw new FileError(`File not found: ${safe}`);
  await touchProject(projectId);
  await syncToSandbox(projectId, { remove: [safe] });
  return safe;
}

export async function renameFile(projectId: string, from: string, to: string) {
  const src = assertPath(from);
  const dst = assertPath(to);
  const content = await readFile(projectId, src);
  if (content === null) throw new FileError(`File not found: ${src}`);
  await writeFiles(projectId, [{ path: dst, content }]);
  await deleteFile(projectId, src);
  return { from: src, to: dst };
}

export function buildFileTree(paths: string[]) {
  return paths.join("\n");
}
