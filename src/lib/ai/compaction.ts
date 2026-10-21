import "server-only";
import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema";
import { newId } from "@/lib/server/ids";
import { isProviderConfigured, resolveModel } from "./catalog";
import type { ModelInfo } from "./models";
import { streamModel } from "./providers";
import { fromLastCompaction } from "./providers/shared";
import type { CompactionContent, NeutralMessage, Usage } from "./types";

const SUMMARIZER_PROMPT = `You compress a coding-agent conversation into a handoff note for the same agent. Keep everything needed to continue the work and drop the rest.

Write these sections in plain markdown:
## Goal
## User preferences and decisions
## What exists now (pages, components, data, packages, design system)
## Files touched (path: one line on what it contains)
## Open tasks and known errors
## Last thing the user asked

Be specific (names, colors, routes, package names). No code blocks. Under 900 words.`;

/** Threshold (input tokens) above which the conversation is compacted before the next step. */
export function compactionThreshold(model: ModelInfo, tokenSaver: boolean) {
  const configured = Number(process.env.FORGED_COMPACT_AT_TOKENS || 150_000);
  const cap = Math.floor(model.contextWindow * 0.7);
  return Math.min(tokenSaver ? Math.min(configured, 60_000) : configured, cap);
}

function transcript(history: NeutralMessage[]) {
  const lines: string[] = [];
  for (const m of fromLastCompaction(history)) {
    if (m.role === "user") {
      if (m.content.kind === "compaction") lines.push(`PREVIOUS SUMMARY:\n${m.content.summary}`);
      else lines.push(`USER: ${m.content.text}${m.content.attachments?.length ? ` [${m.content.attachments.length} image(s) attached]` : ""}`);
    } else if (m.role === "assistant") {
      for (const p of m.content.parts) {
        if (p.type === "text" && p.text.trim()) lines.push(`AGENT: ${p.text.trim()}`);
        if (p.type === "tool_call") {
          const i = p.input as Record<string, unknown>;
          const arg = typeof i.path === "string" ? i.path : typeof i.query === "string" ? i.query : typeof i.question === "string" ? i.question : "";
          lines.push(`AGENT CALLED ${p.name}${arg ? `(${arg})` : ""}`);
        }
      }
    } else {
      for (const r of m.content.results) lines.push(`RESULT ${r.name}${r.isError ? " (error)" : ""}: ${r.output.slice(0, r.name === "ask_user" ? 800 : 300)}`);
    }
  }
  let text = lines.join("\n");
  if (text.length > 240_000) text = `${text.slice(0, 60_000)}\n…[middle omitted]…\n${text.slice(-170_000)}`;
  return text;
}

async function summarizerModel(current: ModelInfo) {
  if (current.provider === "anthropic" && isProviderConfigured("anthropic")) return (await resolveModel("claude-haiku-5-5")) ?? current;
  if (current.provider === "openrouter" && isProviderConfigured("openrouter")) return (await resolveModel("gemini-3.6-flash")) ?? current;
  return current;
}

/**
 * Replaces the conversation with a structured summary (simple client-side compaction:
 * nothing before the summary is replayed, so no stale reasoning blocks are sent).
 */
export async function compactConversation(input: {
  projectId: string;
  runId: string | null;
  history: NeutralMessage[];
  model: ModelInfo;
  reason: "auto" | "manual";
  signal?: AbortSignal;
}) {
  const model = await summarizerModel(input.model);
  const text = transcript(input.history);
  let summary = "";
  let usage: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  if (model.provider === "mock") {
    summary = `## Goal\n${text.split("\n").find((l) => l.startsWith("USER:"))?.slice(6) ?? "Continue the project."}\n\n## What exists now\nSee the project files.\n\n## Last thing the user asked\n${[...text.split("\n")].reverse().find((l) => l.startsWith("USER:"))?.slice(6) ?? ""}`;
  } else {
    for await (const ev of streamModel({
      model,
      system: SUMMARIZER_PROMPT,
      messages: [{ role: "user", content: { kind: "user", text: `<transcript>\n${text}\n</transcript>\n\nWrite the handoff note.` } }],
      tools: [],
      tokenSaver: false,
      signal: input.signal,
      maxTokens: 4000,
    })) {
      if (ev?.type === "done") {
        summary = ev.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n").trim();
        usage = ev.usage;
      }
    }
  }
  if (!summary) throw new Error("Compaction produced an empty summary");
  const compacted = fromLastCompaction(input.history).length;
  const content: CompactionContent = { kind: "compaction", summary, compactedMessages: compacted, reason: input.reason };
  const [row] = await db
    .insert(messages)
    .values({ id: newId("msg"), projectId: input.projectId, runId: input.runId, role: "user", content, model: model.id, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens })
    .returning();
  return { row, content, usage, summarizer: model };
}
