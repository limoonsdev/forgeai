import "server-only";
import OpenAI from "openai";
import type {
  ChatCompletionChunk,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import type { AssistantContent, NeutralMessage } from "../types";
import { normalizeHistory, ProviderError, userTurnText, type ProviderRequest, type ProviderStream } from "./shared";

let client: OpenAI | null = null;
function getClient() {
  client ??= new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    maxRetries: 3,
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://forged.dev",
      "X-Title": "Forged.dev",
    },
  });
  return client;
}

const KEEP_RECENT_TOOL_MESSAGES = 6;

/** Client-side history trimming used by token saver for providers without server-side context editing. */
function trimForTokenSaver(messages: NeutralMessage[]): NeutralMessage[] {
  const toolIdx = messages.map((m, i) => (m.role === "tool" ? i : -1)).filter((i) => i >= 0);
  const cutoff = toolIdx.length > KEEP_RECENT_TOOL_MESSAGES ? toolIdx[toolIdx.length - KEEP_RECENT_TOOL_MESSAGES] : -1;
  return messages.map((m, i) => {
    if (i >= cutoff) return m;
    if (m.role === "tool") {
      return {
        ...m,
        content: {
          ...m.content,
          results: m.content.results.map((r) =>
            r.output.length > 400 && r.name !== "ask_user" ? { ...r, output: `${r.output.slice(0, 200)}… [trimmed by token saver]` } : r,
          ),
        },
      };
    }
    if (m.role === "assistant") {
      return {
        ...m,
        content: {
          ...m.content,
          parts: m.content.parts.map((p) =>
            p.type === "tool_call" && (p.name === "write_file" || p.name === "edit_file")
              ? { ...p, input: { path: p.input.path, note: "[content omitted by token saver — read the file for its current content]" } }
              : p,
          ),
        },
      };
    }
    return m;
  });
}

function toOpenAIMessages(req: ProviderRequest): ChatCompletionMessageParam[] {
  const history = normalizeHistory(req.tokenSaver ? trimForTokenSaver(req.messages) : req.messages);
  const out: ChatCompletionMessageParam[] = [{ role: "system", content: req.system }];
  for (const msg of history) {
    if (msg.role === "user") {
      out.push({ role: "user", content: userTurnText(msg.content) });
    } else if (msg.role === "assistant") {
      const text = msg.content.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("\n")
        .trim();
      const calls = msg.content.parts.filter((p) => p.type === "tool_call");
      if (!text && !calls.length) continue;
      out.push({
        role: "assistant",
        content: text || null,
        ...(calls.length
          ? {
              tool_calls: calls.map((c) => ({
                id: c.id,
                type: "function" as const,
                function: { name: c.name, arguments: JSON.stringify(c.input) },
              })),
            }
          : {}),
      });
    } else {
      for (const r of msg.content.results) {
        if (r.pending) continue;
        out.push({ role: "tool", tool_call_id: r.toolCallId, content: r.isError ? `Error: ${r.output}` : r.output || "(no output)" });
      }
    }
  }
  return out;
}

function toOpenAITools(req: ProviderRequest): ChatCompletionTool[] {
  return req.tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }));
}

type ChunkWithExtras = ChatCompletionChunk & { usage?: ChatCompletionChunk["usage"] & { cost?: number } };

export async function* streamOpenRouter(req: ProviderRequest): ProviderStream {
  const calls = new Map<number, { id: string; name: string; args: string }>();
  let text = "";
  let finish: string | null = null;
  let usage: { prompt: number; completion: number; cached: number; cost?: number } = { prompt: 0, completion: 0, cached: 0 };
  let servedModel: string | undefined;

  try {
    const stream = await getClient().chat.completions.create(
      {
        model: req.model.apiModel,
        messages: toOpenAIMessages(req),
        tools: toOpenAITools(req),
        tool_choice: "auto",
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: Math.min(req.model.maxOutputTokens, req.tokenSaver ? 16_000 : 32_000),
        // OpenRouter extension: report the exact USD cost of the call.
        ...({ usage: { include: true } } as Record<string, unknown>),
      },
      { signal: req.signal },
    );

    for await (const raw of stream) {
      const chunk = raw as ChunkWithExtras;
      servedModel ??= chunk.model;
      if (chunk.usage) {
        usage = {
          prompt: chunk.usage.prompt_tokens ?? 0,
          completion: chunk.usage.completion_tokens ?? 0,
          cached: chunk.usage.prompt_tokens_details?.cached_tokens ?? 0,
          cost: chunk.usage.cost,
        };
      }
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta as typeof choice.delta & { reasoning?: string | null };
      if (delta?.reasoning) yield { type: "thinking_delta", text: delta.reasoning };
      if (delta?.content) {
        text += delta.content;
        yield { type: "text_delta", text: delta.content };
      }
      for (const tc of delta?.tool_calls ?? []) {
        let entry = calls.get(tc.index);
        if (!entry) {
          entry = { id: tc.id || `call_${tc.index}_${Date.now()}`, name: tc.function?.name || "", args: "" };
          calls.set(tc.index, entry);
          if (entry.name) yield { type: "tool_call_start", id: entry.id, name: entry.name };
        } else if (!entry.name && tc.function?.name) {
          entry.name = tc.function.name;
          yield { type: "tool_call_start", id: entry.id, name: entry.name };
        }
        if (tc.function?.arguments) {
          entry.args += tc.function.arguments;
          yield { type: "tool_call_delta", id: entry.id, partialJson: tc.function.arguments };
        }
      }
      if (choice.finish_reason) finish = choice.finish_reason;
    }
  } catch (err) {
    if (err instanceof OpenAI.APIUserAbortError) throw err;
    if (err instanceof OpenAI.APIError) {
      const status = err.status;
      throw new ProviderError(
        status === 401
          ? "The OpenRouter API key configured on this server is invalid."
          : status === 402
            ? "The OpenRouter account backing this server is out of credits."
            : status === 429
              ? "The model is rate limited right now. Please retry in a moment."
              : `Model provider error: ${err.message}`,
        status,
        status === 429 || (status ?? 0) >= 500,
      );
    }
    throw err;
  }

  const parts: AssistantContent["parts"] = [];
  if (text.trim()) parts.push({ type: "text", text });
  for (const [, c] of [...calls.entries()].sort((a, b) => a[0] - b[0])) {
    let input: Record<string, unknown>;
    try {
      input = c.args.trim() ? JSON.parse(c.args) : {};
    } catch {
      input = { __invalid_json: c.args.slice(0, 2000) };
    }
    parts.push({ type: "tool_call", id: c.id, name: c.name, input });
  }

  yield {
    type: "done",
    parts,
    usage: {
      inputTokens: Math.max(0, usage.prompt - usage.cached),
      outputTokens: usage.completion,
      cacheReadTokens: usage.cached,
      cacheWriteTokens: 0,
      reportedCostUsd: usage.cost,
    },
    stopReason:
      finish === "tool_calls" || (calls.size > 0 && finish !== "length")
        ? "tool_use"
        : finish === "length"
          ? "max_tokens"
          : finish === "content_filter"
            ? "refusal"
            : "end_turn",
    servedModel,
  };
}
