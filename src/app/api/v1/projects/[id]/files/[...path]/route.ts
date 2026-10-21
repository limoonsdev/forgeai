import { z } from "zod";
import { deleteFile, readFile, writeFile } from "@/lib/server/files";
import { getOwnedProject } from "@/lib/server/projects";
import { errorResponse, json, readJson, withApi } from "@/lib/server/api";

type P = { id: string; path: string[] };

export const GET = withApi<P>(async (_req, { auth, params }) => {
  const p = await getOwnedProject(auth.userId, params.id);
  if (!p) return errorResponse(404, "not_found", "Project not found");
  const path = params.path.join("/");
  const content = await readFile(p.id, path);
  if (content === null) return errorResponse(404, "not_found", `File not found: ${path}`);
  return json({ path, content });
});

export const PUT = withApi<P>(async (req, { auth, params }) => {
  const p = await getOwnedProject(auth.userId, params.id);
  if (!p) return errorResponse(404, "not_found", "Project not found");
  const { content } = z.object({ content: z.string() }).parse(await readJson(req));
  const saved = await writeFile(p.id, params.path.join("/"), content);
  return json({ path: saved, saved: true });
});

export const DELETE = withApi<P>(async (_req, { auth, params }) => {
  const p = await getOwnedProject(auth.userId, params.id);
  if (!p) return errorResponse(404, "not_found", "Project not found");
  const removed = await deleteFile(p.id, params.path.join("/"));
  return json({ path: removed, deleted: true });
});
