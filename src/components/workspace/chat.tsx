"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { BrainIcon, ChevronRightIcon, SparklesIcon } from "lucide-react";
import type { ChatMessageDTO, PollInput, ToolResultPart } from "@/lib/ai/types";
import { getModel } from "@/lib/ai/models";
import { LogoMark } from "@/components/brand/logo";
import { Markdown } from "@/components/shared/markdown";
import { formatCredits, cn } from "@/lib/utils";
import { PollCard } from "./poll-card";
import { peekInput, ToolRow } from "./tool-row";
import type { StreamingMessage } from "./use-agent";

function Thinking({ text, live }: { text: string; live?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!text.trim() && !live) return null;
  return (
    <div className="text-xs text-muted-foreground">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 hover:text-foreground">
        <BrainIcon className="size-3.5" />
        <span className={cn(live && "shimmer-text")}>{live ? "Thinking…" : "Thought process"}</span>
        {text.trim() && <ChevronRightIcon className={cn("size-3 transition-transform", open && "rotate-90")} />}
      </button>
      {open && text.trim() && <div className="mt-1.5 border-l-2 pl-3 leading-relaxed whitespace-pre-wrap">{text}</div>}
    </div>
  );
}

function AssistantHeader({ model, cost }: { model?: string | null; cost?: number }) {
  const m = getModel(model);
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <LogoMark className="size-4" />
      <span className="font-medium text-foreground">Forged</span>
      {m && <span className="rounded-md border px-1.5 py-px text-[10px]">{m.label}</span>}
      {cost !== undefined && cost > 0 && <span className="ml-auto tabular-nums">{formatCredits(cost, { precise: true })}</span>}
    </div>
  );
}

type Group = { kind: "user"; message: ChatMessageDTO } | { kind: "assistant"; messages: ChatMessageDTO[] };

function groupMessages(messages: ChatMessageDTO[]): Group[] {
  const groups: Group[] = [];
  for (const m of messages) {
    if (m.content.kind === "user") {
      if (!m.content.hidden) groups.push({ kind: "user", message: m });
      continue;
    }
    if (m.content.kind !== "assistant") continue;
    const last = groups[groups.length - 1];
    if (last?.kind === "assistant") last.messages.push(m);
    else groups.push({ kind: "assistant", messages: [m] });
  }
  return groups;
}

export function ChatMessages({
  messages,
  streaming,
  results,
  pendingPollId,
  onAnswerPoll,
  onOpenFile,
  running,
}: {
  messages: ChatMessageDTO[];
  streaming: StreamingMessage | null;
  results: Record<string, ToolResultPart>;
  pendingPollId: string | null;
  onAnswerPoll: (toolCallId: string, answer: string) => void;
  onOpenFile: (path: string) => void;
  running: boolean;
}) {
  const bottom = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const groups = groupMessages(messages);

  useEffect(() => {
    if (stick.current) bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, streaming]);

  return (
    <div
      ref={container}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      }}
      className="flex-1 space-y-6 overflow-y-auto px-4 py-6 scrollbar-thin"
      data-testid="chat-messages"
    >
      {groups.map((g) =>
        g.kind === "user" ? (
          <motion.div key={g.message.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
            <div className="max-w-[88%] rounded-2xl rounded-tr-md bg-secondary px-4 py-2.5 text-[0.92rem] leading-relaxed whitespace-pre-wrap" data-testid="user-message">
              {g.message.content.kind === "user" && g.message.content.text}
            </div>
          </motion.div>
        ) : (
          <div key={g.messages[0].id} className="space-y-2.5" data-testid="assistant-turn">
            <AssistantHeader model={g.messages[0].model} cost={g.messages.reduce((s, m) => s + m.costMicros, 0)} />
            {g.messages.map((m) =>
              m.content.kind === "assistant" ? (
                <div key={m.id} className="space-y-2">
                  {m.content.parts.map((p, i) => {
                    if (p.type === "thinking") return <Thinking key={i} text={p.text} />;
                    if (p.type === "text") return p.text.trim() ? <Markdown key={i}>{p.text}</Markdown> : null;
                    if (p.name === "ask_user") {
                      const r = results[p.id];
                      return (
                        <PollCard
                          key={p.id}
                          poll={(r?.meta?.poll as PollInput) ?? (p.input as unknown as PollInput)}
                          active={pendingPollId === p.id && !running}
                          answer={typeof r?.meta?.answer === "string" ? r.meta.answer : undefined}
                          skipped={Boolean(r?.meta?.skipped)}
                          onAnswer={(a) => onAnswerPoll(p.id, a)}
                        />
                      );
                    }
                    return <ToolRow key={p.id} name={p.name} input={p.input} result={results[p.id]} onOpenFile={onOpenFile} />;
                  })}
                </div>
              ) : null,
            )}
          </div>
        ),
      )}

      {streaming && (
        <div className="space-y-2.5">
          {(groups[groups.length - 1]?.kind !== "assistant") && <AssistantHeader model={streaming.model} />}
          <Thinking text={streaming.thinking} live={!streaming.text && !streaming.tools.length} />
          {streaming.text && <Markdown>{streaming.text}</Markdown>}
          {streaming.tools.map((t) => (
            <ToolRow key={t.id} name={t.name} input={peekInput(t.json)} result={results[t.id]} streaming onOpenFile={onOpenFile} />
          ))}
        </div>
      )}

      {running && !streaming && (
        <div className="flex items-center gap-2 text-xs">
          <SparklesIcon className="size-3.5 text-primary" />
          <span className="shimmer-text">Forging…</span>
        </div>
      )}
      <div ref={bottom} />
    </div>
  );
}
