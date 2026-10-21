import { readFile } from "@/lib/server/files";
import { getOwnedProject } from "@/lib/server/projects";
import { errorResponse, json, withApi } from "@/lib/server/api";

type P = { id: string; path: string[] };

/** Read-only: project code can only be changed by the agent (prevents code injection into VMs). */
export const GET = withApi<P>(async (_req, { auth, params }) => {
  const p = await getOwnedProject(auth.userId, params.id);
  if (!p) return errorResponse(404, "not_found", "Project not found");
  const path = params.path.join("/");
  const content = await readFile(p.id, path);
  if (content === null) return errorResponse(404, "not_found", `File not found: ${path}`);
  return json({ path, content });
});
