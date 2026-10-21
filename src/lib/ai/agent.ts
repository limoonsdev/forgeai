import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, preferences, projects, runs, user, type Message, type RunStatus } from "@/lib/db/schema";
import { CREDITS, type PlanId } from "@/lib/config";
import { chargeRunUsage, getBalance } from "@/lib/server/credits";
import { maybeRewardReferrer } from "@/lib/server/referrals";
import { newId } from "@/lib/server/ids";
import { listFiles } from "@/lib/server/files";
import { getEnabledSkills } from "@/lib/skills";
import { canUseModel, computeCostUsd, pickDefaultModel, resolveModel } from "./catalog";
import { buildTurnContext } from "./context";
import { loadHistory, toDTO, toNeutral } from "./history";
import { SYSTEM_PROMPT } from "./prompts";
import { streamModel, ProviderError } from "./providers";
import { FALLBACK_PRICING } from "./providers/anthropic";
import { executeToolCall } from "./tool-executor";
import { TOOLS } from "./tools";
import { getActiveRun, publish, registerRun, unregisterRun } from "./run-registry";
import type { AssistantContent, MessageContent, NeutralMessage, ProviderEvent, RunEvent, ToolContent, ToolResultPart } from "./types";

export class AgentError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "bad_request",
  ) {
    super(message);
  }
}

export type StartRunInput = {
  projectId: string;
  userId: string;
  /** New user prompt… */
  prompt?: string;
  /** …or the answer to a pending ask_user poll. */
  pollAnswer?: { toolCallId: string; answer: string };
  modelId?: string;
  tokenSaver?: boolean;
  source?: "web" | "api";
};

const MAX_STEPS = 60;
const MAX_STEPS_SAVER = 30;

async function insertMessage(
  projectId: string,
  runId: string,
  role: Message["role"],
  content: MessageContent,
  extra: Partial<typeof messages.$inferInsert> = {},
) {
  const [row] = await db
    .insert(messages)
    .values({ id: newId("msg"), projectId, runId, role, content, ...extra })
    .returning();
  return row;
}

/**
 * Validates the request, records the user turn and kicks off the agent loop in the background.
 * Returns once the run is registered so callers can subscribe to its events.
 */
export async function startRun(input: StartRunInput) {
  const [project] = await db.select().from(projects).where(and(eq(projects.id, input.projectId), eq(projects.userId, input.userId)));
  if (!project) throw new AgentError("Project not found", 404, "not_found");
  if (getActiveRun(project.id)) throw new AgentError("The agent is already working on this project.", 409, "run_in_progress");
  if (!input.prompt?.trim() && !input.pollAnswer) throw new AgentError("A prompt is required.");

  const [owner] = await db.select().from(user).where(eq(user.id, input.userId));
  const [prefs] = await db.select().from(preferences).where(eq(preferences.userId, input.userId));
  const plan = (owner?.plan ?? "free") as PlanId;

  const modelId = input.modelId || project.model || pickDefaultModel(prefs?.defaultModel, plan);
  const model = await resolveModel(modelId);
  if (!model) throw new AgentError(`Unknown model "${modelId}".`);
  const allowed = canUseModel(model, plan);
  if (!allowed.ok) throw new AgentError(allowed.reason, 403, "model_unavailable");

  const balance = owner?.creditsMicros ?? 0;
  if (balance < CREDITS.minBalanceToRunMicros)
    throw new AgentError("You're out of credits. Top up or invite a friend to get $5 free.", 402, "insufficient_credits");

  const tokenSaver = input.tokenSaver ?? project.tokenSaver ?? prefs?.tokenSaver ?? false;
  const runId = newId("run");

  // Register first so concurrent requests are rejected immediately.
  const live = registerRun(project.id, runId);
  let turnMessage: ReturnType<typeof toDTO>;
  try {
    await db.insert(runs).values({
      id: runId,
      projectId: project.id,
      userId: input.userId,
      model: model.id,
      tokenSaver,
      source: input.source ?? "web",
    });
    await db
      .update(projects)
      .set({ status: "running", model: model.id, updatedAt: new Date() })
      .where(eq(projects.id, project.id));

    const history = await loadHistory(project.id);
    const last = history[history.length - 1];
    const pendingTool =
      last?.role === "tool" && (last.content as ToolContent).results.some((r) => r.pending) ? last : null;

    if (input.pollAnswer) {
      if (!pendingTool) throw new AgentError("There is no pending question to answer.", 409, "no_pending_poll");
      const content = last.content as ToolContent;
      const target = content.results.find((r) => r.toolCallId === input.pollAnswer!.toolCallId && r.pending);
      if (!target) throw new AgentError("This question was already answered.", 409, "poll_answered");
      const answer = input.pollAnswer.answer.trim().slice(0, 2000) || "(no answer)";
      const updated: ToolContent = {
        kind: "tool",
        results: content.results.map((r) =>
          r === target ? { ...r, pending: false, output: `The user answered: ${answer}`, meta: { ...r.meta, answer } } : r,
        ),
      };
      await db.update(messages).set({ content: updated }).where(eq(messages.id, pendingTool.id));
      turnMessage = toDTO({ ...pendingTool, content: updated });
      publish(project.id, { type: "message", message: turnMessage });
    } else {
      if (pendingTool) {
        // The user ignored the poll and wrote a message instead: close the poll before appending the new turn.
        const content = pendingTool.content as ToolContent;
        const closed: ToolContent = {
          kind: "tool",
          results: content.results.map((r) =>
            r.pending ? { ...r, pending: false, output: "The user skipped this question and sent a new message instead.", meta: { ...r.meta, skipped: true } } : r,
          ),
        };
        await db.update(messages).set({ content: closed }).where(eq(messages.id, pendingTool.id));
        publish(project.id, { type: "message", message: toDTO({ ...pendingTool, content: closed }) });
      }
      const files = await listFiles(project.id);
      const skills = await getEnabledSkills(input.userId);
      const context = buildTurnContext({ project, prefs: prefs ?? null, files: files.map((f) => f.path), skills, tokenSaver });
      const row = await insertMessage(project.id, runId, "user", { kind: "user", text: input.prompt!.trim().slice(0, 20_000), context });
      turnMessage = toDTO(row);
      publish(project.id, { type: "message", message: turnMessage });
    }
  } catch (err) {
    unregisterRun(project.id, runId);
    await db.update(projects).set({ status: "idle" }).where(eq(projects.id, project.id));
    await db.delete(runs).where(eq(runs.id, runId));
    throw err;
  }

  publish(project.id, { type: "run_start", runId, model: model.id });
  void runLoop({ projectId: project.id, userId: input.userId, runId, model, tokenSaver, signal: live.abort.signal });
  return { runId, model: model.id, tokenSaver, message: turnMessage };
}

async function runLoop(opts: {
  projectId: string;
  userId: string;
  runId: string;
  model: NonNullable<Awaited<ReturnType<typeof resolveModel>>>;
  tokenSaver: boolean;
  signal: AbortSignal;
}) {
  const { projectId, userId, runId, model, tokenSaver, signal } = opts;
  const emit = (e: RunEvent) => publish(projectId, e);
  let status: RunStatus = "completed";
  let error: string | undefined;
  let runCost = 0;
  let steps = 0;
  let totalIn = 0;
  let totalOut = 0;
  const maxSteps = tokenSaver ? MAX_STEPS_SAVER : MAX_STEPS;

  const heartbeat = setInterval(() => emit({ type: "ping" }), 15_000);
  try {
    const history: NeutralMessage[] = (await loadHistory(projectId)).map(toNeutral);

    while (true) {
      if (signal.aborted) {
        status = "stopped";
        break;
      }
      if (steps >= maxSteps) {
        status = "completed";
        await appendNote(projectId, runId, history, `I paused after ${steps} steps to keep things under control. Send "continue" to keep going.`);
        break;
      }
      steps++;

      const messageId = newId("msg");
      emit({ type: "assistant_start", messageId, model: model.id });

      let done: Extract<ProviderEvent, { type: "done" }> | null = null;
      for await (const ev of streamModel({ model, system: SYSTEM_PROMPT, messages: history, tools: TOOLS, tokenSaver, signal })) {
        if (!ev) continue;
        switch (ev.type) {
          case "retry":
            emit({ type: "assistant_start", messageId, model: model.id });
            break;
          case "text_delta":
            emit({ type: "text_delta", messageId, text: ev.text });
            break;
          case "thinking_delta":
            emit({ type: "thinking_delta", messageId, text: ev.text });
            break;
          case "tool_call_start":
            emit({ type: "tool_call_start", messageId, toolCallId: ev.id, name: ev.name });
            break;
          case "tool_call_delta":
            emit({ type: "tool_call_delta", messageId, toolCallId: ev.id, partialJson: ev.partialJson });
            break;
          case "done":
            done = ev;
            break;
        }
      }
      if (!done) throw new ProviderError("The model stream ended unexpectedly.");

      // Bill the step.
      const pricing = done.servedModel && FALLBACK_PRICING[done.servedModel] ? { ...model, pricing: FALLBACK_PRICING[done.servedModel] } : model;
      const costMicros = Math.ceil(computeCostUsd(pricing, done.usage) * CREDITS.markup * 1_000_000);
      runCost += costMicros;
      totalIn += done.usage.inputTokens + done.usage.cacheReadTokens + done.usage.cacheWriteTokens;
      totalOut += done.usage.outputTokens;

      const content: AssistantContent = { kind: "assistant", parts: done.parts, stopReason: done.stopReason };
      const row = await db
        .insert(messages)
        .values({
          id: messageId,
          projectId,
          runId,
          role: "assistant",
          content,
          model: model.id,
          inputTokens: done.usage.inputTokens,
          outputTokens: done.usage.outputTokens,
          cacheReadTokens: done.usage.cacheReadTokens,
          cacheWriteTokens: done.usage.cacheWriteTokens,
          costMicros,
        })
        .returning();
      history.push({ role: "assistant", content, model: model.id });
      emit({ type: "message", message: toDTO(row[0]) });

      const balance = await chargeRunUsage({
        userId,
        runId,
        costMicros,
        description: `${model.label} · ${steps} step${steps > 1 ? "s" : ""}`,
        metadata: { projectId, model: model.id, steps },
      });
      await db
        .update(runs)
        .set({ steps, costMicros: runCost, inputTokens: totalIn, outputTokens: totalOut })
        .where(eq(runs.id, runId));
      await db
        .update(projects)
        .set({ totalCostMicros: sql`${projects.totalCostMicros} + ${costMicros}` })
        .where(eq(projects.id, projectId));
      emit({ type: "usage", costMicros, runCostMicros: runCost, balanceMicros: balance });

      if (done.stopReason === "refusal") {
        status = "error";
        error = "The model declined this request. Try rephrasing it or switch to another model.";
        break;
      }

      const calls = done.parts.filter((p) => p.type === "tool_call");
      if (!calls.length) break;

      // Execute tool calls (sequentially: file operations must apply in order).
      const results: ToolResultPart[] = [];
      let paused = false;
      for (const call of calls) {
        if (signal.aborted) {
          results.push({ type: "tool_result", toolCallId: call.id, name: call.name, output: "Stopped by the user.", isError: true });
          continue;
        }
        if (done.stopReason === "max_tokens") {
          results.push({
            type: "tool_result",
            toolCallId: call.id,
            name: call.name,
            output: "Your output hit the token limit and this tool input may be truncated, so it was not executed. Split the work into smaller files or edits.",
            isError: true,
          });
          continue;
        }
        const result = await executeToolCall({ projectId, userId, emit, signal }, call);
        results.push(result);
        emit({ type: "tool_result", toolCallId: call.id, result });
        if (result.pending) {
          paused = true;
          emit({ type: "poll", toolCallId: call.id, poll: result.meta?.poll as never });
        }
      }
      const toolContent: ToolContent = { kind: "tool", results };
      const toolRow = await insertMessage(projectId, runId, "tool", toolContent);
      history.push({ role: "tool", content: toolContent });
      emit({ type: "message", message: toDTO(toolRow) });

      if (paused) {
        status = "awaiting_input";
        break;
      }
      if (balance <= 0) {
        status = "insufficient_credits";
        error = "You ran out of credits during this run.";
        break;
      }
    }
  } catch (err) {
    if (signal.aborted) {
      status = "stopped";
    } else {
      status = "error";
      error = err instanceof ProviderError ? err.message : `Something went wrong: ${(err as Error).message}`;
      console.error("[agent] run failed", err);
    }
  } finally {
    clearInterval(heartbeat);
  }

  await db.update(runs).set({ status, error, finishedAt: new Date() }).where(eq(runs.id, runId));
  await db
    .update(projects)
    .set({ status: status === "awaiting_input" ? "awaiting_input" : status === "error" ? "error" : "idle", updatedAt: new Date() })
    .where(eq(projects.id, projectId));
  if (status === "completed") await maybeRewardReferrer(userId).catch((e) => console.error("[referral] reward failed", e));
  emit({ type: "run_end", status, error, runCostMicros: runCost });
  unregisterRun(projectId, runId);
}

async function appendNote(projectId: string, runId: string, history: NeutralMessage[], text: string) {
  const content: AssistantContent = { kind: "assistant", parts: [{ type: "text", text }] };
  const row = await insertMessage(projectId, runId, "assistant", content);
  history.push({ role: "assistant", content });
  publish(projectId, { type: "message", message: toDTO(row) });
}

export async function getLatestRun(projectId: string) {
  const [r] = await db.select().from(runs).where(eq(runs.projectId, projectId)).orderBy(desc(runs.startedAt)).limit(1);
  return r ?? null;
}

export { getBalance };
