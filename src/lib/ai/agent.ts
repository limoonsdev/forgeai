import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { attachments, messages, preferences, projects, runs, user, type Message, type RunStatus } from "@/lib/db/schema";
import { CREDITS, planLimits, type PlanId } from "@/lib/config";
import { connectorContext, secretValuesForUser } from "@/lib/connectors";
import { chargeRunUsage, getBalance } from "@/lib/server/credits";
import { maybeRewardReferrer } from "@/lib/server/referrals";
import { newId } from "@/lib/server/ids";
import { listFiles } from "@/lib/server/files";
import { notifyUser } from "@/lib/server/notifications";
import { getEnabledSkills } from "@/lib/skills";
import { canUseModel, computeCostUsd, pickDefaultModel, resolveModel } from "./catalog";
import { compactConversation, compactionThreshold } from "./compaction";
import { buildTurnContext } from "./context";
import { loadHistory, toDTO, toNeutral } from "./history";
import type { ModelInfo } from "./models";
import { checkPrompt, recordViolation } from "./moderation";
import { SYSTEM_PROMPT } from "./prompts";
import { streamModel, ProviderError } from "./providers";
import { FALLBACK_PRICING } from "./providers/anthropic";
import { executeToolCall } from "./tool-executor";
import { TOOLS } from "./tools";
import { countActiveRuns, getActiveRun, isPauseRequested, publish, registerRun, unregisterRun } from "./run-registry";
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
  attachmentIds?: string[];
  /** …or the answer to a pending ask_user poll… */
  pollAnswer?: { toolCallId: string; answer: string };
  /** …or continue a paused / interrupted run. */
  resume?: boolean;
  modelId?: string;
  tokenSaver?: boolean;
  source?: "web";
};

const MAX_STEPS = 60;
const MAX_STEPS_SAVER = 30;
const MAX_CONCURRENT_RUNS = Number(process.env.FORGED_MAX_CONCURRENT_RUNS || 12);
const MAX_RUNS_PER_USER = Number(process.env.FORGED_MAX_RUNS_PER_USER || 3);

async function insertMessage(projectId: string, runId: string, role: Message["role"], content: MessageContent, extra: Partial<typeof messages.$inferInsert> = {}) {
  const [row] = await db.insert(messages).values({ id: newId("msg"), projectId, runId, role, content, ...extra }).returning();
  return row;
}

/** Loads image bytes for user attachments referenced in the history (base64, cached for the run). */
async function loadAttachmentData(history: NeutralMessage[], userId: string) {
  const ids = new Set<string>();
  for (const m of history) if (m.role === "user" && m.content.kind === "user") for (const a of m.content.attachments ?? []) ids.add(a.id);
  const map = new Map<string, { mime: string; data: string }>();
  if (!ids.size) return map;
  const rows = await db
    .select({ id: attachments.id, mime: attachments.mime, data: attachments.data })
    .from(attachments)
    .where(and(inArray(attachments.id, [...ids]), eq(attachments.userId, userId)));
  for (const r of rows) map.set(r.id, { mime: r.mime, data: Buffer.from(r.data).toString("base64") });
  return map;
}

function scrub(text: string, secrets: string[]) {
  let out = text;
  for (const s of secrets) if (out.includes(s)) out = out.split(s).join("[redacted secret]");
  return out;
}

/**
 * Validates the request, records the user turn and starts the agent loop in the background.
 * Returns once the run is registered so callers can subscribe to its events.
 */
export async function startRun(input: StartRunInput) {
  const [project] = await db.select().from(projects).where(and(eq(projects.id, input.projectId), eq(projects.userId, input.userId)));
  if (!project) throw new AgentError("Project not found", 404, "not_found");
  if (getActiveRun(project.id)) throw new AgentError("The agent is already working on this project.", 409, "run_in_progress");
  if (!input.prompt?.trim() && !input.pollAnswer && !input.resume && !input.attachmentIds?.length) throw new AgentError("A prompt is required.");

  const [owner] = await db.select().from(user).where(eq(user.id, input.userId));
  if (!owner) throw new AgentError("Account not found", 404, "not_found");
  if (owner.bannedAt) throw new AgentError("This account has been suspended for violating the Acceptable Use Policy.", 403, "banned");
  if (owner.restrictedAt) throw new AgentError(`Your account is restricted (${owner.restrictReason ?? "policy review"}). Contact support to appeal.`, 403, "restricted");
  if (countActiveRuns() >= MAX_CONCURRENT_RUNS) throw new AgentError("Forged is very busy right now. Please try again in a minute.", 503, "server_busy");
  if (countActiveRuns(input.userId) >= MAX_RUNS_PER_USER) throw new AgentError(`You already have ${MAX_RUNS_PER_USER} agents running. Wait for one to finish or pause it.`, 429, "too_many_runs");

  // Trust & safety: blocked prompts never reach a model.
  if (input.prompt?.trim()) {
    const verdict = await checkPrompt(input.prompt);
    if (!verdict.ok) {
      const action = await recordViolation(input.userId, project.id, verdict, input.prompt);
      throw new AgentError(
        action === "blocked" ? verdict.message : `${verdict.message} Your account has been ${action === "banned" ? "suspended" : "restricted"}.`,
        403,
        "content_blocked",
      );
    }
  }

  const [prefs] = await db.select().from(preferences).where(eq(preferences.userId, input.userId));
  const plan = (owner.plan ?? "free") as PlanId;
  const modelId = input.modelId || project.model || pickDefaultModel(prefs?.defaultModel, plan);
  const model = await resolveModel(modelId);
  if (!model) throw new AgentError(`Unknown model "${modelId}".`);
  const allowed = canUseModel(model, plan);
  if (!allowed.ok) throw new AgentError(allowed.reason, 403, "model_unavailable");

  if (owner.creditsMicros < CREDITS.minBalanceToRunMicros) {
    throw new AgentError(
      owner.emailVerified ? "You're out of credits. Invite a friend to get $5 for free." : "Verify your email to unlock your free credits.",
      402,
      "insufficient_credits",
    );
  }

  const tokenSaver = input.tokenSaver ?? project.tokenSaver ?? prefs?.tokenSaver ?? false;
  const runId = newId("run");
  const live = registerRun(project.id, runId, input.userId);
  let turnMessage: ReturnType<typeof toDTO> | null = null;
  try {
    await db.insert(runs).values({ id: runId, projectId: project.id, userId: input.userId, model: model.id, tokenSaver, source: "web" });
    await db.update(projects).set({ status: "running", model: model.id, updatedAt: new Date() }).where(eq(projects.id, project.id));

    const history = await loadHistory(project.id);
    const last = history[history.length - 1];
    const pendingTool = last?.role === "tool" && (last.content as ToolContent).results.some((r) => r.pending) ? last : null;

    if (input.resume) {
      // Close tool calls that were cut off by a pause, a stop or a server restart.
      if (last?.role === "assistant") {
        const calls = (last.content as AssistantContent).parts.filter((p) => p.type === "tool_call");
        if (calls.length) {
          const content: ToolContent = {
            kind: "tool",
            results: calls.map((c) => ({ type: "tool_result", toolCallId: c.id, name: c.name, output: "This tool call was interrupted before it finished. Run it again if it is still needed.", isError: true })),
          };
          const row = await insertMessage(project.id, runId, "tool", content);
          turnMessage = toDTO(row);
        }
      }
    } else if (input.pollAnswer) {
      if (!pendingTool) throw new AgentError("There is no pending question to answer.", 409, "no_pending_poll");
      const content = pendingTool.content as ToolContent;
      const target = content.results.find((r) => r.toolCallId === input.pollAnswer!.toolCallId && r.pending);
      if (!target) throw new AgentError("This question was already answered.", 409, "poll_answered");
      const answer = input.pollAnswer.answer.trim().slice(0, 2000) || "(no answer)";
      const updated: ToolContent = {
        kind: "tool",
        results: content.results.map((r) => (r === target ? { ...r, pending: false, output: `The user answered: ${answer}`, meta: { ...r.meta, answer } } : r)),
      };
      await db.update(messages).set({ content: updated }).where(eq(messages.id, pendingTool.id));
      turnMessage = toDTO({ ...pendingTool, content: updated });
    } else {
      if (pendingTool) {
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
      // Attachments must belong to this user.
      let atts: { id: string; name: string; mime: string }[] = [];
      if (input.attachmentIds?.length) {
        atts = await db
          .select({ id: attachments.id, name: attachments.name, mime: attachments.mime })
          .from(attachments)
          .where(and(inArray(attachments.id, input.attachmentIds.slice(0, 8)), eq(attachments.userId, input.userId)));
      }
      const files = await listFiles(project.id);
      const skills = await getEnabledSkills(input.userId);
      const conns = await connectorContext(input.userId);
      const context = buildTurnContext({ project, prefs: prefs ?? null, files: files.map((f) => f.path), skills, tokenSaver, connectors: conns.lines });
      const row = await insertMessage(project.id, runId, "user", {
        kind: "user",
        text: (input.prompt ?? "").trim().slice(0, 20_000) || "(see attached images)",
        context,
        ...(atts.length ? { attachments: atts } : {}),
      });
      turnMessage = toDTO(row);
    }
    if (turnMessage) publish(project.id, { type: "message", message: turnMessage });
  } catch (err) {
    unregisterRun(project.id, runId);
    await db.update(projects).set({ status: "idle" }).where(eq(projects.id, project.id));
    await db.delete(runs).where(eq(runs.id, runId));
    throw err;
  }

  publish(project.id, { type: "run_start", runId, model: model.id });
  void runLoop({
    projectId: project.id,
    projectName: project.name,
    userId: input.userId,
    runId,
    model,
    tokenSaver,
    plan,
    signal: live.abort.signal,
  });
  return { runId, model: model.id, tokenSaver, message: turnMessage };
}

async function runLoop(opts: { projectId: string; projectName: string; userId: string; runId: string; model: ModelInfo; tokenSaver: boolean; plan: PlanId; signal: AbortSignal }) {
  const { projectId, userId, runId, model, tokenSaver, signal } = opts;
  const emit = (e: RunEvent) => publish(projectId, e);
  let status: RunStatus = "completed";
  let error: string | undefined;
  let runCost = 0;
  let steps = 0;
  let totalIn = 0;
  let totalOut = 0;
  let lastInputTokens = 0;
  let lastText = "";
  const maxSteps = tokenSaver ? MAX_STEPS_SAVER : MAX_STEPS;
  const threshold = compactionThreshold(model, tokenSaver);
  const startedAt = Date.now();

  const heartbeat = setInterval(() => emit({ type: "ping" }), 15_000);
  try {
    let history: NeutralMessage[] = (await loadHistory(projectId)).map(toNeutral);
    const attachmentData = await loadAttachmentData(history, userId);
    const secrets = await secretValuesForUser(userId);

    while (true) {
      if (signal.aborted) {
        status = "stopped";
        break;
      }
      if (isPauseRequested(projectId)) {
        status = "paused";
        break;
      }
      if (steps >= maxSteps) {
        await appendNote(projectId, runId, history, `I paused after ${steps} steps to keep costs under control. Press Resume to keep going.`);
        status = "paused";
        break;
      }

      // Automatic compaction when the context approaches the limit.
      if (lastInputTokens > threshold) {
        emit({ type: "status", message: "Compacting the conversation…" });
        const c = await compactConversation({ projectId, runId, history, model, reason: "auto", signal });
        const cost = Math.ceil(computeCostUsd(c.summarizer, c.usage) * CREDITS.markup * 1_000_000);
        runCost += cost;
        await chargeRunUsage({ userId, runId, costMicros: cost, description: `${model.label} · compaction`, metadata: { projectId } });
        history = [{ role: "user", content: c.content }];
        lastInputTokens = 0;
        emit({ type: "compaction", summary: c.content.summary });
        emit({ type: "message", message: toDTO(c.row) });
      }
      steps++;

      const messageId = newId("msg");
      emit({ type: "assistant_start", messageId, model: model.id });

      let done: Extract<ProviderEvent, { type: "done" }> | null = null;
      for await (const ev of streamModel({ model, system: SYSTEM_PROMPT, messages: history, tools: TOOLS, tokenSaver, signal, attachments: attachmentData })) {
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

      const pricing = done.servedModel && FALLBACK_PRICING[done.servedModel] ? { ...model, pricing: FALLBACK_PRICING[done.servedModel] } : model;
      const costMicros = Math.ceil(computeCostUsd(pricing, done.usage) * CREDITS.markup * 1_000_000);
      runCost += costMicros;
      lastInputTokens = done.usage.inputTokens + done.usage.cacheReadTokens + done.usage.cacheWriteTokens;
      totalIn += lastInputTokens;
      totalOut += done.usage.outputTokens;

      const content: AssistantContent = { kind: "assistant", parts: done.parts, stopReason: done.stopReason };
      const text = done.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n").trim();
      if (text) lastText = text;
      const [row] = await db
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
      emit({ type: "message", message: toDTO(row) });

      let balance = await chargeRunUsage({ userId, runId, costMicros, description: `${model.label} · ${steps} step${steps > 1 ? "s" : ""}`, metadata: { projectId, model: model.id, steps } });
      await db.update(runs).set({ steps, costMicros: runCost, inputTokens: totalIn, outputTokens: totalOut }).where(eq(runs.id, runId));
      await db.update(projects).set({ totalCostMicros: sql`${projects.totalCostMicros} + ${costMicros}` }).where(eq(projects.id, projectId));
      emit({ type: "usage", costMicros, runCostMicros: runCost, balanceMicros: balance });

      if (done.stopReason === "refusal") {
        status = "error";
        error = "The model declined this request. Rephrase it or pick another model.";
        break;
      }

      const calls = done.parts.filter((p) => p.type === "tool_call");
      if (!calls.length) break;

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
        const result = await executeToolCall(
          {
            projectId,
            userId,
            emit,
            signal,
            coordinator: { runId, model, tokenSaver, parallelAgents: planLimits(opts.plan).parallelAgents, projectName: opts.projectName },
          },
          call,
        );
        result.output = scrub(result.output, secrets);
        const subCost = Number(result.meta?.subagentCostMicros ?? 0);
        if (subCost > 0) {
          runCost += subCost;
          balance = await getBalance(userId);
          emit({ type: "usage", costMicros: subCost, runCostMicros: runCost, balanceMicros: balance });
        }
        results.push(result);
        emit({ type: "tool_result", toolCallId: call.id, result: { ...result, images: undefined } });
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
    if (signal.aborted) status = "stopped";
    else {
      status = "error";
      error = err instanceof ProviderError ? err.message : "Something went wrong while running the agent. You can resume it.";
      console.error("[agent] run failed", (err as Error).message);
    }
  } finally {
    clearInterval(heartbeat);
  }

  await db.update(runs).set({ status, error, costMicros: runCost, finishedAt: new Date() }).where(eq(runs.id, runId));
  await db
    .update(projects)
    .set({
      status: status === "awaiting_input" ? "awaiting_input" : status === "paused" ? "paused" : status === "error" ? "error" : "idle",
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));
  if (status === "completed") await maybeRewardReferrer(userId).catch((e) => console.error("[referral] reward failed", e));
  emit({ type: "run_end", status, error, runCostMicros: runCost });
  unregisterRun(projectId, runId);

  // Notifications for long runs (or when the agent needs the user).
  const long = Date.now() - startedAt > 45_000;
  if (status === "awaiting_input") void notifyUser(userId, "awaiting_input", { text: "The agent asked you a question and is waiting for your answer.", projectId, projectName: opts.projectName });
  else if (status === "completed" && long) void notifyUser(userId, "run_completed", { text: lastText.slice(0, 600) || "Your request is done.", projectId, projectName: opts.projectName });
  else if (status === "error") void notifyUser(userId, "run_failed", { text: error ?? "The run failed.", projectId, projectName: opts.projectName });
}

async function appendNote(projectId: string, runId: string, history: NeutralMessage[], text: string) {
  const content: AssistantContent = { kind: "assistant", parts: [{ type: "text", text }] };
  const row = await insertMessage(projectId, runId, "assistant", content);
  history.push({ role: "assistant", content });
  publish(projectId, { type: "message", message: toDTO(row) });
}

/** Manual "compact now" from the chat (only when no run is active). */
export async function compactNow(projectId: string, userId: string) {
  const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  if (!project) throw new AgentError("Project not found", 404, "not_found");
  if (getActiveRun(projectId)) throw new AgentError("Wait for the agent to finish before compacting.", 409, "run_in_progress");
  const history = (await loadHistory(projectId)).map(toNeutral);
  if (history.length < 4) throw new AgentError("The conversation is too short to compact.");
  const [owner] = await db.select({ plan: user.plan, credits: user.creditsMicros }).from(user).where(eq(user.id, userId));
  if ((owner?.credits ?? 0) < CREDITS.minBalanceToRunMicros) throw new AgentError("You're out of credits.", 402, "insufficient_credits");
  const model = (await resolveModel(project.model || pickDefaultModel(null, (owner?.plan ?? "free") as PlanId)))!;
  const c = await compactConversation({ projectId, runId: null, history, model, reason: "manual" });
  const cost = Math.ceil(computeCostUsd(c.summarizer, c.usage) * CREDITS.markup * 1_000_000);
  if (cost > 0) await chargeRunUsage({ userId, runId: `compact_${c.row.id}`, costMicros: cost, description: "Conversation compaction", metadata: { projectId } });
  return toDTO(c.row);
}

export async function getLatestRun(projectId: string) {
  const [r] = await db.select().from(runs).where(eq(runs.projectId, projectId)).orderBy(desc(runs.startedAt)).limit(1);
  return r ?? null;
}

/** After a restart, runs that were in flight are marked paused so users can resume them. */
export async function recoverInterruptedRuns() {
  const stale = await db.select({ id: runs.id, projectId: runs.projectId }).from(runs).where(eq(runs.status, "running"));
  for (const r of stale) {
    if (getActiveRun(r.projectId)) continue;
    await db.update(runs).set({ status: "paused", error: "Interrupted by a server restart", finishedAt: new Date() }).where(eq(runs.id, r.id));
    await db.update(projects).set({ status: "paused" }).where(eq(projects.id, r.projectId));
  }
  return stale.length;
}

export { getBalance };
