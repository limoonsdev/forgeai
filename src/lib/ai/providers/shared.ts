import type { ModelInfo } from "../models";
import type { NeutralMessage, ProviderEvent, ToolDefinition, ToolResultPart } from "../types";

export type ProviderRequest = {
  model: ModelInfo;
  system: string;
  messages: NeutralMessage[];
  tools: ToolDefinition[];
  tokenSaver: boolean;
  signal?: AbortSignal;
};

export type ProviderStream = AsyncGenerator<ProviderEvent | { type: "retry" }, void, void>;

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryable = false,
  ) {
    super(message);
  }
}

/**
 * Guarantees every tool call has a matching result in the following message.
 * Runs deterministically so a replayed history is always identical.
 */
export function normalizeHistory(messages: NeutralMessage[]): NeutralMessage[] {
  const out: NeutralMessage[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    out.push(msg);
    if (msg.role !== "assistant") continue;
    const calls = msg.content.parts.filter((p) => p.type === "tool_call");
    if (!calls.length) continue;
    const next = messages[i + 1];
    const answered = new Set(next?.role === "tool" ? next.content.results.filter((r) => !r.pending).map((r) => r.toolCallId) : []);
    const missing = calls.filter((c) => !answered.has(c.id));
    if (!missing.length) continue;
    const filler: ToolResultPart[] = missing.map((c) => ({
      type: "tool_result",
      toolCallId: c.id,
      name: c.name,
      output: "This tool call was interrupted before it completed.",
      isError: true,
    }));
    if (next?.role === "tool") {
      const answeredResults = next.content.results.filter((r) => !r.pending);
      out.push({ role: "tool", content: { kind: "tool", results: [...answeredResults, ...filler] } });
      i++;
    } else {
      out.push({ role: "tool", content: { kind: "tool", results: filler } });
    }
  }
  return out;
}

export function userTurnText(content: { text: string; context?: string }) {
  return content.context ? `${content.context}\n\n${content.text}` : content.text;
}
