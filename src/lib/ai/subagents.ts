import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentTasks } from "@/lib/db/schema";
import { CREDITS } from "@/lib/config";
import { chargeRunUsage } from "@/lib/server/credits";
import { newId } from "@/lib/server/ids";
import { computeCostUsd } from "./catalog";
import type { ModelInfo } from "./models";
import { streamModel } from "./providers";
import type { ToolContext } from "./tool-executor";
import { describeToolCall, SUBAGENT_TOOLS } from "./tools";
import type { AssistantContent, NeutralMessage, ProviderEvent, ToolCallPart, ToolResultPart } from "./types";

const SUBAGENT_PROMPT = `You are a Forged sub-agent: a focused engineer working on one part of a Next.js 16 (App Router, React 19, TypeScript, Tailwind CSS v4) app, coordinated by a lead agent who talks to the user.

Rules:
- Do only your task. Stay inside the files you own; you may read anything.
- Every file is .ts/.tsx/.css in the existing structure (app/, components/, lib/). Never create plain HTML files or use another framework.
- Server Components by default, "use client" only where needed. Import icons from lucide-react, animations from motion/react, cn() from @/lib/utils.
- Write complete, typed, production-quality code with real copy. Follow the design decisions given in your task.
- Write code only through tools. When done, reply with a short summary: what you built, files changed, anything the lead must wire up or verify.`;

export type SubAgentSpec = { name: string; task: string; files?: string[] };

export type SubAgentContext = ToolContext & {
  runId: string;
  toolCallId: string;
  model: ModelInfo;
  tokenSaver: boolean;
  parallel: number;
  execute: (ctx: ToolContext, call: ToolCallPart) => Promise<ToolResultPart>;
};

const MAX_STEPS = 20;

async function runOne(ctx: SubAgentContext, spec: SubAgentSpec, owners: Map<string, string>, brief: string) {
  const taskId = newId("task");
  const log: { t: string; label: string; ok?: boolean }[] = [];
  await db.insert(agentTasks).values({ id: taskId, runId: ctx.runId, projectId: ctx.projectId, toolCallId: ctx.toolCallId, name: spec.name, task: spec.task });
  const emit = (status: string, label?: string, extra: { steps?: number; costMicros?: number } = {}) =>
    ctx.emit({ type: "subagent", toolCallId: ctx.toolCallId, taskId, name: spec.name, status, label, ...extra });
  emit("running", "Starting");

  const guardWrite = (path: string) => {
    const owner = owners.get(path);
    return owner && owner !== spec.name ? `${path} is owned by sub-agent "${owner}". Coordinate through your summary instead of editing it.` : null;
  };
  const childCtx: ToolContext = { ...ctx, guardWrite };

  const history: NeutralMessage[] = [{ role: "user", content: { kind: "user", text: `${brief}\n\n# Your task (${spec.name})\n${spec.task}\n\n# Files you own\n${spec.files?.join("\n") || "(not specified: create new files under a folder named after your task)"}` } }];
  let cost = 0;
  let steps = 0;
  let status: "completed" | "failed" | "stopped" = "completed";
  let summary = "";
  const changed = new Set<string>();

  try {
    while (steps < MAX_STEPS) {
      if (ctx.signal.aborted) {
        status = "stopped";
        break;
      }
      steps++;
      let done: Extract<ProviderEvent, { type: "done" }> | null = null;
      for await (const ev of streamModel({ model: ctx.model, system: SUBAGENT_PROMPT, messages: history, tools: SUBAGENT_TOOLS, tokenSaver: ctx.tokenSaver, signal: ctx.signal, maxTokens: 32_000 })) {
        if (ev?.type === "done") done = ev;
      }
      if (!done) throw new Error("empty response");
      const stepCost = Math.ceil(computeCostUsd(ctx.model, done.usage) * CREDITS.markup * 1_000_000);
      cost += stepCost;
      await chargeRunUsage({ userId: ctx.userId, runId: ctx.runId, costMicros: stepCost, description: `${ctx.model.label} · sub-agents`, metadata: { projectId: ctx.projectId } });
      const content: AssistantContent = { kind: "assistant", parts: done.parts, stopReason: done.stopReason };
      history.push({ role: "assistant", content });
      const calls = done.parts.filter((p) => p.type === "tool_call");
      const text = done.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n").trim();
      if (text) summary = text;
      if (!calls.length || done.stopReason === "refusal") break;
      const results: ToolResultPart[] = [];
      for (const call of calls) {
        if (done.stopReason === "max_tokens") {
          results.push({ type: "tool_result", toolCallId: call.id, name: call.name, output: "Output truncated; split the work into smaller files.", isError: true });
          continue;
        }
        const r = await ctx.execute(childCtx, call);
        results.push(r);
        const label = describeToolCall(call.name, call.input);
        log.push({ t: new Date().toISOString(), label, ok: !r.isError });
        if (!r.isError && (call.name === "write_file" || call.name === "edit_file") && typeof call.input.path === "string") changed.add(call.input.path);
        emit("running", label, { steps, costMicros: cost });
      }
      history.push({ role: "tool", content: { kind: "tool", results } });
    }
  } catch (err) {
    status = ctx.signal.aborted ? "stopped" : "failed";
    summary = summary || `Failed: ${(err as Error).message}`;
  }

  await db
    .update(agentTasks)
    .set({ status, steps, costMicros: cost, summary: summary.slice(0, 4000), log, finishedAt: new Date() })
    .where(eq(agentTasks.id, taskId));
  emit(status, status === "completed" ? "Done" : status, { steps, costMicros: cost });
  return { name: spec.name, status, summary, changed: [...changed], cost };
}

/** Runs sub-agents with a concurrency limit and returns a report for the coordinator. */
export async function runSubAgents(ctx: SubAgentContext, specs: SubAgentSpec[], brief: string) {
  const owners = new Map<string, string>();
  for (const s of specs) for (const f of s.files ?? []) if (!owners.has(f)) owners.set(f, s.name);

  const queue = specs.slice();
  const results: Awaited<ReturnType<typeof runOne>>[] = [];
  const workers = Array.from({ length: Math.max(1, Math.min(ctx.parallel, specs.length)) }, async () => {
    while (queue.length) {
      const spec = queue.shift()!;
      results.push(await runOne(ctx, spec, owners, brief));
    }
  });
  await Promise.all(workers);
  const totalCost = results.reduce((s, r) => s + r.cost, 0);
  const report = results
    .map((r) => `## ${r.name} (${r.status})\n${r.summary || "(no summary)"}\nFiles changed: ${r.changed.join(", ") || "none"}`)
    .join("\n\n");
  return { report, totalCost, results };
}
