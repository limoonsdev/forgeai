import { getAllFiles, listFiles } from "@/lib/server/files";
import { getOwnedProject } from "@/lib/server/projects";
import { errorResponse, json, withApi } from "@/lib/server/api";

type P = { id: string };

/** List files. Pass ?content=1 to include every file's content. */
export const GET = withApi<P>(async (req, { auth, params }) => {
  const p = await getOwnedProject(auth.userId, params.id);
  if (!p) return errorResponse(404, "not_found", "Project not found");
  const withContent = new URL(req.url).searchParams.get("content") === "1";
  if (withContent) return json({ files: await getAllFiles(p.id) });
  const files = await listFiles(p.id);
  return json({ files: files.map((f) => ({ path: f.path, size: Number(f.size), updatedAt: f.updatedAt })) });
});
