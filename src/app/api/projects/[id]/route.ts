import { z } from "zod";
import { getModel } from "@/lib/ai/models";
import { getActiveRun } from "@/lib/ai/run-registry";
import { deleteProject, getOwnedProject, serializeProject, updateProject } from "@/lib/server/projects";
import { errorResponse, json, readJson, withApi } from "@/lib/server/api";

type P = { id: string };

export const GET = withApi<P>(async (_req, { auth, params }) => {
  const p = await getOwnedProject(auth.userId, params.id);
  if (!p) return errorResponse(404, "not_found", "Project not found");
  const run = getActiveRun(p.id);
  return json({ project: serializeProject(p), activeRun: run ? { id: run.runId } : null });
});

const PatchBody = z.object({
  name: z.string().max(60).optional(),
  description: z.string().max(300).optional(),
  model: z.string().max(60).nullable().optional(),
  tokenSaver: z.boolean().nullable().optional(),
});

export const PATCH = withApi<P>(async (req, { auth, params }) => {
  const body = PatchBody.parse(await readJson(req));
  if (body.model && !getModel(body.model)) return errorResponse(400, "invalid_model", `Unknown model "${body.model}"`);
  const p = await updateProject(auth.userId, params.id, body);
  if (!p) return errorResponse(404, "not_found", "Project not found");
  return json({ project: serializeProject(p) });
});

export const DELETE = withApi<P>(async (_req, { auth, params }) => {
  const ok = await deleteProject(auth.userId, params.id);
  if (!ok) return errorResponse(404, "not_found", "Project not found");
  return json({ deleted: true });
});
