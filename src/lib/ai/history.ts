import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, type Message } from "@/lib/db/schema";
import type { ChatMessageDTO, MessageContent, NeutralMessage } from "./types";

export function toNeutral(row: Pick<Message, "role" | "content" | "model">): NeutralMessage {
  const content = row.content as MessageContent;
  if (row.role === "user") return { role: "user", content: content as Extract<MessageContent, { kind: "user" }> };
  if (row.role === "assistant")
    return { role: "assistant", content: content as Extract<MessageContent, { kind: "assistant" }>, model: row.model };
  return { role: "tool", content: content as Extract<MessageContent, { kind: "tool" }> };
}

/** DTO for clients: thinking signatures and per-turn context are stripped. */
export function toDTO(row: Message, opts: { includeContext?: boolean } = {}): ChatMessageDTO {
  let content = row.content as MessageContent;
  if (content.kind === "assistant") {
    content = {
      ...content,
      parts: content.parts
        .filter((p) => !(p.type === "thinking" && !p.text))
        .map((p) => (p.type === "thinking" ? { type: "thinking", text: p.text } : p)),
    };
  } else if (content.kind === "user" && !opts.includeContext) {
    content = { kind: "user", text: content.text, hidden: content.hidden };
  }
  return {
    id: row.id,
    seq: row.seq,
    role: row.role,
    content,
    model: row.model,
    costMicros: row.costMicros,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function loadHistory(projectId: string) {
  return db.select().from(messages).where(eq(messages.projectId, projectId)).orderBy(asc(messages.seq));
}
