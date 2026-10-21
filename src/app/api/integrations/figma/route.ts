import { z } from "zod";
import { FigmaError, importFigma } from "@/lib/integrations/figma";
import { getOwnedProject } from "@/lib/server/projects";
import { errorResponse, json, readJson, withApi } from "@/lib/server/api";

const Body = z.object({ url: z.string().max(1000), projectId: z.string().max(40).optional() });

/** Imports Figma frames as image attachments plus a design brief for the next prompt. */
export const POST = withApi(
  async (req, { auth }) => {
    const body = Body.parse(await readJson(req, 4096));
    if (body.projectId && !(await getOwnedProject(auth.userId, body.projectId))) return errorResponse(404, "not_found", "Project not found");
    try {
      return json(await importFigma(auth.userId, body.url, body.projectId ?? null));
    } catch (err) {
      if (err instanceof FigmaError) return errorResponse(err.status, "figma_error", err.message);
      throw err;
    }
  },
  { rateLimit: 10, bucket: "figma" },
);
