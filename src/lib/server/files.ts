import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { projectFiles, projects } from "@/lib/db/schema";
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
  return db
    .select({ path: projectFiles.path, size: sql<number>`length(${projectFiles.content})`, updatedAt: projectFiles.updatedAt })
    .from(projectFiles)
    .where(eq(projectFiles.projectId, projectId))
    .orderBy(asc(projectFiles.path));
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
  const deleted = await db
    .delete(projectFiles)
    .where(and(eq(projectFiles.projectId, projectId), eq(projectFiles.path, safe)))
    .returning({ path: projectFiles.path });
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
