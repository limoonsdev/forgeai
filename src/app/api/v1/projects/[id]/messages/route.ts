import { z } from "zod";
import { startRun, getLatestRun } from "@/lib/ai/agent";
import { loadHistory, toDTO } from "@/lib/ai/history";
import { subscribe } from "@/lib/ai/run-registry";
import type { RunEvent } from "@/lib/ai/types";
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
    latestRun: run
      ? { id: run.id, status: run.status, model: run.model, costMicros: run.costMicros, error: run.error, startedAt: run.startedAt }
      : null,
  });
});

const PostBody = z
  .object({
    prompt: z.string().max(20_000).optional(),
    pollAnswer: z.object({ toolCallId: z.string(), answer: z.string().max(2000) }).optional(),
    model: z.string().max(60).optional(),
    tokenSaver: z.boolean().optional(),
    /** "stream" (SSE, default for the web app), "wait" (block until done) or "async" (return immediately). */
    mode: z.enum(["stream", "wait", "async"]).optional(),
  })
  .refine((b) => Boolean(b.prompt?.trim()) || Boolean(b.pollAnswer), { message: "prompt or pollAnswer is required" });

export const POST = withApi<P>(async (req, { auth, params }) => {
  const body = PostBody.parse(await readJson(req));
  const mode = body.mode ?? (req.headers.get("accept")?.includes("text/event-stream") ? "stream" : "wait");
  const run = await startRun({
    projectId: params.id,
    userId: auth.userId,
    prompt: body.prompt,
    pollAnswer: body.pollAnswer,
    modelId: body.model,
    tokenSaver: body.tokenSaver,
    source: auth.via === "api_key" ? "api" : "web",
  });

  if (mode === "stream")
    return runEventStream(params.id, req.signal, {
      replay: true,
      initial: [{ type: "message", message: run.message }],
    });
  if (mode === "async") return json({ run: { id: run.runId, model: run.model, status: "running" }, message: run.message }, { status: 202 });

  // "wait": block until the run finishes, then return the new messages.
  const end = await new Promise<Extract<RunEvent, { type: "run_end" }>>((resolve) => {
    const unsub = subscribe(params.id, (e) => {
      if (e.type === "run_end") {
        unsub?.();
        resolve(e);
      }
    });
    if (!unsub) resolve({ type: "run_end", status: "completed", runCostMicros: 0 });
  });
  const rows = await loadHistory(params.id);
  const fresh = rows.filter((r) => r.runId === run.runId).map((r) => toDTO(r));
  const lastText = [...fresh]
    .reverse()
    .find((m) => m.content.kind === "assistant" && m.content.parts.some((p) => p.type === "text"));
  const reply =
    lastText && lastText.content.kind === "assistant"
      ? lastText.content.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n")
      : null;
  return json({ run: { id: run.runId, model: run.model, status: end.status, error: end.error ?? null, costMicros: end.runCostMicros }, reply, messages: fresh });
});
