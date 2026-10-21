import { getOwnedProject } from "@/lib/server/projects";
import { runEventStream } from "@/lib/server/sse";
import { errorResponse, withApi } from "@/lib/server/api";

type P = { id: string };

/** Subscribe to the live events of the project's active run (SSE). Sends {type:"idle"} when nothing runs. */
export const GET = withApi<P>(async (req, { auth, params }) => {
  const p = await getOwnedProject(auth.userId, params.id);
  if (!p) return errorResponse(404, "not_found", "Project not found");
  return runEventStream(p.id, req.signal, { replay: true });
});
