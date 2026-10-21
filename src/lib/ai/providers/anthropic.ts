import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlock,
  BetaContentBlockParam,
  BetaMessageParam,
  BetaToolUnion,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { AssistantContent, ProviderEvent } from "../types";
import { compactionText, normalizeHistory, ProviderError, type ProviderRequest, type ProviderStream } from "./shared";

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 3 });
  return client;
}

/** Prices for models a server-side refusal fallback may route to (USD / MTok). */
export const FALLBACK_PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
};

function toAnthropicMessages(req: ProviderRequest): BetaMessageParam[] {
  const out: BetaMessageParam[] = [];
  for (const msg of normalizeHistory(req.messages)) {
    if (msg.role === "user") {
      const blocks: BetaContentBlockParam[] = [];
      if (msg.content.kind === "compaction") {
        blocks.push({ type: "text", text: compactionText(msg.content.summary) });
      } else {
        if (msg.content.context) blocks.push({ type: "text", text: msg.content.context });
        for (const a of msg.content.attachments ?? []) {
          const img = req.attachments?.get(a.id);
          if (img) blocks.push({ type: "image", source: { type: "base64", media_type: img.mime as "image/png", data: img.data } });
        }
        blocks.push({ type: "text", text: msg.content.text || "(see attached images)" });
      }
      out.push({ role: "user", content: blocks });
    } else if (msg.role === "assistant") {
      const blocks: BetaContentBlockParam[] = [];
      for (const part of msg.content.parts) {
        if (part.type === "thinking") {
          // Thinking blocks are replayed unchanged; the API drops any the current model cannot read.
          if (part.redactedData) blocks.push({ type: "redacted_thinking", data: part.redactedData });
          else if (part.signature) blocks.push({ type: "thinking", thinking: part.text, signature: part.signature });
        } else if (part.type === "text") {
          if (part.text.trim()) blocks.push({ type: "text", text: part.text });
        } else if (part.type === "tool_call") {
          blocks.push({ type: "tool_use", id: part.id, name: part.name, input: part.input });
        }
      }
      if (blocks.length) out.push({ role: "assistant", content: blocks });
    } else {
      const blocks: BetaContentBlockParam[] = msg.content.results
        .filter((r) => !r.pending)
        .map((r) => ({
          type: "tool_result" as const,
          tool_use_id: r.toolCallId,
          content: r.images?.length
            ? [
                { type: "text" as const, text: r.output || "(no output)" },
                ...r.images.map((img) => ({ type: "image" as const, source: { type: "base64" as const, media_type: img.mime as "image/jpeg", data: img.data } })),
              ]
            : r.output || "(no output)",
          ...(r.isError ? { is_error: true } : {}),
        }));
      if (blocks.length) out.push({ role: "user", content: blocks });
    }
  }
  return out;
}

function toAnthropicTools(req: ProviderRequest): BetaToolUnion[] {
  return req.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as { type: "object"; [k: string]: unknown },
    // Stream large inputs (file contents) as they are generated; inputs are validated with zod before use.
    ...(t.streamsLargeInput ? { eager_input_streaming: true } : {}),
  }));
}

/** Converts the final content, applying the refusal-fallback echo rules. */
function toParts(content: BetaContentBlock[]): AssistantContent["parts"] {
  let blocks = content;
  const lastFallback = blocks.map((b) => b.type).lastIndexOf("fallback");
  if (lastFallback >= 0) {
    blocks = blocks.filter((b, i) => {
      if (b.type === "fallback") return false;
      if (i < lastFallback && (b.type === "thinking" || b.type === "redacted_thinking" || b.type === "tool_use")) return false;
      return true;
    });
  }
  const parts: AssistantContent["parts"] = [];
  for (const b of blocks) {
    if (b.type === "text") parts.push({ type: "text", text: b.text });
    else if (b.type === "thinking") parts.push({ type: "thinking", text: b.thinking, signature: b.signature });
    else if (b.type === "redacted_thinking") parts.push({ type: "thinking", text: "", redactedData: b.data });
    else if (b.type === "tool_use")
      parts.push({ type: "tool_call", id: b.id, name: b.name, input: (b.input ?? {}) as Record<string, unknown> });
  }
  return parts;
}

export async function* streamAnthropic(req: ProviderRequest): ProviderStream {
  const model = req.model;
  const cfg = model.anthropic ?? { effort: { normal: "medium", saver: "low" }, serverFallback: false };
  const betas: string[] = [];
  if (cfg.serverFallback) betas.push("server-side-fallback-2026-07-01");
  if (req.tokenSaver) betas.push("context-management-2025-06-27");

  const messages = toAnthropicMessages(req);
  const tools = toAnthropicTools(req);

  for (let attempt = 0; ; attempt++) {
    const indexToToolId = new Map<number, string>();
    try {
      const stream = getClient().beta.messages.stream(
        {
          model: model.apiModel,
          max_tokens: req.maxTokens ?? (req.tokenSaver ? 32_000 : 64_000),
          system: req.system,
          messages,
          ...(tools.length ? { tools, tool_choice: { type: "auto" as const } } : {}),
          thinking: { type: "adaptive", display: "summarized" },
          output_config: { effort: req.tokenSaver ? cfg.effort.saver : cfg.effort.normal },
          // Automatic prompt caching of the longest stable prefix.
          cache_control: { type: "ephemeral" },
          ...(betas.length ? { betas: betas as never } : {}),
          ...(cfg.serverFallback ? { fallbacks: "default" as const } : {}),
          ...(req.tokenSaver
            ? {
                context_management: {
                  edits: [
                    {
                      type: "clear_tool_uses_20250919" as const,
                      trigger: { type: "input_tokens" as const, value: 40_000 },
                      keep: { type: "tool_uses" as const, value: 6 },
                      clear_tool_inputs: true,
                      exclude_tools: ["ask_user", "update_plan", "set_project_info"],
                    },
                  ],
                },
              }
            : {}),
        },
        { signal: req.signal },
      );

      for await (const event of stream) {
        if (event.type === "content_block_start") {
          if (event.content_block.type === "tool_use") {
            indexToToolId.set(event.index, event.content_block.id);
            yield { type: "tool_call_start", id: event.content_block.id, name: event.content_block.name };
          }
        } else if (event.type === "content_block_delta") {
          const d = event.delta;
          if (d.type === "text_delta") yield { type: "text_delta", text: d.text };
          else if (d.type === "thinking_delta") yield { type: "thinking_delta", text: d.thinking };
          else if (d.type === "input_json_delta") {
            const id = indexToToolId.get(event.index);
            if (id && d.partial_json) yield { type: "tool_call_delta", id, partialJson: d.partial_json };
          }
        }
      }

      const final = await stream.finalMessage();
      const usage = final.usage;
      const stop = final.stop_reason;
      const done: ProviderEvent = {
        type: "done",
        parts: toParts(final.content),
        usage: {
          inputTokens: usage.input_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
          cacheReadTokens: usage.cache_read_input_tokens ?? 0,
          cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
        },
        stopReason:
          stop === "tool_use"
            ? "tool_use"
            : stop === "end_turn" || stop === "stop_sequence"
              ? "end_turn"
              : stop === "max_tokens" || stop === "model_context_window_exceeded"
                ? "max_tokens"
                : stop === "refusal"
                  ? "refusal"
                  : "other",
        servedModel: final.model,
      };
      yield done;
      return;
    } catch (err) {
      if (err instanceof Anthropic.APIUserAbortError) throw err;
      if (err instanceof Anthropic.APIError) {
        const status = err.status;
        const message =
          status === 401
            ? "The Anthropic API key configured on this server is invalid."
            : status === 429
              ? "The model is rate limited right now. Please retry in a moment."
              : status === 529 || (status ?? 0) >= 500
                ? "Anthropic is temporarily overloaded. Please retry."
                : `Anthropic API error: ${err.message}`;
        throw new ProviderError(message, status, status === 429 || (status ?? 0) >= 500);
      }
      // With eager input streaming, a tool input the SDK cannot parse rejects the stream: re-issue the turn.
      if (attempt >= 2) throw new ProviderError(`Model output could not be parsed: ${(err as Error).message}`);
      console.warn("[anthropic] unparseable tool input, re-issuing the turn", (err as Error).message);
      yield { type: "retry" };
    }
  }
}
