import { z } from "zod";
import { ensureSandbox } from "@/lib/sandbox";
import { getOwnedProject } from "@/lib/server/projects";
import { errorResponse, json, readJson, withApi } from "@/lib/server/api";

type P = { id: string };

/** Run a shell command inside the project's VM (isolated container). */
export const POST = withApi<P>(
  async (req, { auth, params }) => {
    const p = await getOwnedProject(auth.userId, params.id);
    if (!p) return errorResponse(404, "not_found", "Project not found");
    const { command, timeoutMs } = z
      .object({ command: z.string().min(1).max(2000), timeoutMs: z.number().int().min(1000).max(600_000).optional() })
      .parse(await readJson(req));
    const sbx = await ensureSandbox(p.id);
    if (!sbx) return errorResponse(503, "sandbox_unavailable", "The VM could not be started.");
    const result = await sbx.exec(command, { timeoutMs: timeoutMs ?? 120_000 });
    return json(result);
  },
  { rateLimit: 30 },
);
