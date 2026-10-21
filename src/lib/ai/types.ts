/**
 * Provider-neutral conversation format stored in `messages.content`.
 * Adapters translate it to each provider's wire format (Anthropic Messages, OpenAI chat…).
 */

export type TextPart = { type: "text"; text: string };

/** Anthropic thinking block — must be replayed byte-for-byte (signature binds it to the conversation). */
export type ThinkingPart = {
  type: "thinking";
  text: string;
  signature?: string;
  redactedData?: string;
};

export type ToolCallPart = {
  type: "tool_call";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type ToolResultPart = {
  type: "tool_result";
  toolCallId: string;
  name: string;
  output: string;
  isError?: boolean;
  /** ask_user results stay pending until the user answers the poll. */
  pending?: boolean;
  /** UI-only metadata (never sent to the model). */
  meta?: Record<string, unknown>;
  /** Images returned by a tool (e.g. browser screenshots), base64 encoded. */
  images?: { mime: string; data: string }[];
};

export type UserContent = {
  kind: "user";
  text: string;
  /**
   * Per-turn context (file tree, enabled skills, preferences…) computed once when the message is
   * created and replayed verbatim afterwards — history must stay append-only.
   */
  context?: string;
  /** Hidden from the chat UI (e.g. automatic error-fix follow-ups). */
  hidden?: boolean;
  /** Images attached by the user (screenshots, Figma frames). */
  attachments?: { id: string; name: string; mime: string }[];
};

/** A summary that replaces everything before it when the context gets large. */
export type CompactionContent = {
  kind: "compaction";
  summary: string;
  compactedMessages: number;
  reason: "auto" | "manual";
};

export type AssistantContent = {
  kind: "assistant";
  parts: (TextPart | ThinkingPart | ToolCallPart)[];
  stopReason?: string;
};

export type ToolContent = {
  kind: "tool";
  results: ToolResultPart[];
};

export type MessageContent = UserContent | AssistantContent | ToolContent | CompactionContent;

export type NeutralMessage =
  | { role: "user"; content: UserContent | CompactionContent }
  | { role: "assistant"; content: AssistantContent; model?: string | null }
  | { role: "tool"; content: ToolContent };

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Provider-reported USD cost (e.g. OpenRouter), if any. */
  reportedCostUsd?: number;
};

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Large inputs (file contents) benefit from eager input streaming. */
  streamsLargeInput?: boolean;
};

export type ProviderEvent =
  | { type: "text_delta"; text: string }
  | { type: "thinking_delta"; text: string }
  | { type: "tool_call_start"; id: string; name: string }
  | { type: "tool_call_delta"; id: string; partialJson: string }
  | {
      type: "done";
      parts: AssistantContent["parts"];
      usage: Usage;
      stopReason: "end_turn" | "tool_use" | "max_tokens" | "refusal" | "other";
      servedModel?: string;
    };

/** Server-sent events streamed to clients during an agent run. */
export type RunEvent =
  | { type: "run_start"; runId: string; model: string }
  | { type: "message"; message: ChatMessageDTO }
  | { type: "assistant_start"; messageId: string; model: string }
  | { type: "text_delta"; messageId: string; text: string }
  | { type: "thinking_delta"; messageId: string; text: string }
  | { type: "tool_call_start"; messageId: string; toolCallId: string; name: string }
  | { type: "tool_call_delta"; messageId: string; toolCallId: string; partialJson: string }
  | { type: "tool_result"; toolCallId: string; result: ToolResultPart }
  | { type: "files_changed"; paths: string[]; deleted?: string[] }
  | { type: "plan"; items: PlanItem[] }
  | { type: "project"; name?: string; description?: string }
  | { type: "sandbox"; status: string; previewUrl?: string | null; message?: string }
  | { type: "usage"; costMicros: number; runCostMicros: number; balanceMicros: number }
  | { type: "poll"; toolCallId: string; poll: PollInput }
  | { type: "run_end"; status: string; error?: string; runCostMicros: number }
  | { type: "subagent"; toolCallId: string; taskId: string; name: string; status: string; label?: string; steps?: number; costMicros?: number }
  | { type: "browser_frame"; image: string; cursor: { x: number; y: number } | null; action: string; url?: string }
  | { type: "browser_intent"; action: string; cursor: { x: number; y: number } | null; label: string }
  | { type: "compaction"; summary: string }
  | { type: "status"; message: string }
  | { type: "ping" };

export type PlanItem = { title: string; status: "pending" | "in_progress" | "done" };

export type PollInput = {
  question: string;
  options: { label: string; description?: string }[];
  multiSelect?: boolean;
  allowCustom?: boolean;
};

export type ChatMessageDTO = {
  id: string;
  seq: number;
  role: "user" | "assistant" | "tool";
  content: MessageContent;
  model?: string | null;
  costMicros: number;
  inputTokens: number;
  outputTokens: number;
  createdAt: string;
};
