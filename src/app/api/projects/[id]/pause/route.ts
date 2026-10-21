import { requestPause } from "@/lib/ai/run-registry";
import { getOwnedProject } from "@/lib/server/projects";
import { errorResponse, json, withApi } from "@/lib/server/api";

type P = { id: string };

/** Asks the running agent to pause after its current step. Resume by posting `{ resume: true }` to /messages. */
export const POST = withApi<P>(async (_req, { auth, params }) => {
  const p = await getOwnedProject(auth.userId, params.id);
  if (!p) return errorResponse(404, "not_found", "Project not found");
  return json({ pausing: requestPause(p.id) });
});
