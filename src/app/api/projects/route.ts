import { z } from "zod";
import { createProject, deleteProject, listProjects, serializeProject } from "@/lib/server/projects";
import { startRun } from "@/lib/ai/agent";
import { json, readJson, withApi } from "@/lib/server/api";

export const GET = withApi(async (_req, { auth }) => {
  const rows = await listProjects(auth.userId);
  return json({ projects: rows.map(serializeProject) });
});

const CreateBody = z.object({
  name: z.string().max(60).optional(),
  description: z.string().max(300).optional(),
  model: z.string().max(60).optional(),
  tokenSaver: z.boolean().optional(),
  /** Optional first prompt: the agent starts forging right away. */
  prompt: z.string().max(20_000).optional(),
  attachments: z.array(z.string().max(40)).max(8).optional(),
});

export const POST = withApi(
  async (req, { auth }) => {
    const parsed = CreateBody.parse(await readJson(req));
    const body = { ...parsed, model: parsed.model || undefined };
    const project = await createProject(auth.userId, body);
    let run: { runId: string; model: string } | null = null;
    if (body.prompt?.trim() || body.attachments?.length) {
      try {
        const r = await startRun({
          projectId: project.id,
          userId: auth.userId,
          prompt: body.prompt,
          attachmentIds: body.attachments,
          modelId: body.model,
          tokenSaver: body.tokenSaver,
          source: "web",
        });
        run = { runId: r.runId, model: r.model };
      } catch (err) {
        // Don't leave an empty project behind when the first run is refused (credits, moderation…).
        await deleteProject(auth.userId, project.id).catch(() => {});
        throw err;
      }
    }
    return json({ project: serializeProject(project), run }, { status: 201 });
  },
  { rateLimit: 12, bucket: "create-project" },
);
