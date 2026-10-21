import { z } from "zod";
import { startRun, getLatestRun } from "@/lib/ai/agent";
import { loadHistory, toDTO } from "@/lib/ai/history";
import { getOwnedProject } from "@/lib/server/projects";
import { runEventStream } from "@/lib/server/sse";
import { errorResponse, json, readJson, withApi } from "@/lib/server/api";

type P = { id: string };

export const GET = withApi<P>(async (_req, { auth, params }) => {
  const p = await getOwnedProject(auth.userId, params.id);
  if (!p) return errorResponse(404, "not_found", "Project not found");
  const rows = await loadHistory(p.id);
  const run = await getLatestRun(p.id);
  return json({
    messages: rows.map((r) => toDTO(r)),
    latestRun: run ? { id: run.id, status: run.status, model: run.model, costMicros: run.costMicros, error: run.error, startedAt: run.startedAt } : null,
  });
});

const PostBody = z
  .object({
    prompt: z.string().max(20_000).optional(),
    attachments: z.array(z.string().max(64)).max(8).optional(),
    pollAnswer: z.object({ toolCallId: z.string().max(100), answer: z.string().max(2000) }).optional(),
    resume: z.boolean().optional(),
    model: z.string().max(60).optional(),
    tokenSaver: z.boolean().optional(),
  })
  .refine((b) => Boolean(b.prompt?.trim()) || Boolean(b.pollAnswer) || b.resume === true || Boolean(b.attachments?.length), {
    message: "prompt, pollAnswer or resume is required",
  });

/** Starts (or resumes) an agent run and streams its events as Server-Sent Events. */
export const POST = withApi<P>(
  async (req, { auth, params }) => {
    const body = PostBody.parse(await readJson(req, 200_000));
    const run = await startRun({
      projectId: params.id,
      userId: auth.userId,
      prompt: body.prompt,
      attachmentIds: body.attachments,
      pollAnswer: body.pollAnswer,
      resume: body.resume,
      modelId: body.model,
      tokenSaver: body.tokenSaver,
      source: "web",
    });
    return runEventStream(params.id, req.signal, {
      replay: true,
      initial: run.message ? [{ type: "message", message: run.message }] : [],
    });
  },
  { rateLimit: 30, bucket: "runs" },
);
