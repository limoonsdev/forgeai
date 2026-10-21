import { stopRun } from "@/lib/ai/run-registry";
import { getOwnedProject } from "@/lib/server/projects";
import { errorResponse, json, withApi } from "@/lib/server/api";

type P = { id: string };

export const POST = withApi<P>(async (_req, { auth, params }) => {
  const p = await getOwnedProject(auth.userId, params.id);
  if (!p) return errorResponse(404, "not_found", "Project not found");
  return json({ stopped: stopRun(p.id) });
});
