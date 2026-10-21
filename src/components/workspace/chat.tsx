"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { BrainIcon, ChevronRightIcon, FoldVerticalIcon, SparklesIcon } from "lucide-react";
import type { ChatMessageDTO, PollInput, ToolResultPart } from "@/lib/ai/types";
import { getModel } from "@/lib/ai/models";
import { LogoMark } from "@/components/brand/logo";
import { Markdown } from "@/components/shared/markdown";
import { LinkifiedText } from "@/components/prompt/rich-input";
import { formatCredits, cn } from "@/lib/utils";
import { PollCard } from "./poll-card";
import { SubAgentsCard } from "./subagents-card";
import { peekInput, ToolRow } from "./tool-row";
import type { StreamingMessage, SubAgentState } from "./use-agent";

function Thinking({ text, live }: { text: string; live?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!text.trim() && !live) return null;
  return (
    <div className="text-xs text-muted-foreground">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 hover:text-foreground">
        <BrainIcon className="size-3.5" />
        <span className={cn(live && "shimmer-text")}>{live ? "Thinking…" : "Reasoning"}</span>
        {text.trim() && <ChevronRightIcon className={cn("size-3 transition-transform", open && "rotate-90")} />}
      </button>
      {open && text.trim() && <div className="mt-1.5 max-h-80 overflow-y-auto border-l-2 border-primary/30 pl-3 leading-relaxed whitespace-pre-wrap scrollbar-thin">{text}</div>}
    </div>
  );
}

function CompactionDivider({ message }: { message: ChatMessageDTO }) {
  const [open, setOpen] = useState(false);
  if (message.content.kind !== "compaction") return null;
  const c = message.content;
  return (
    <div className="text-xs text-muted-foreground" data-testid="compaction">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 hover:text-foreground">
        <span className="h-px flex-1 bg-border" />
        <FoldVerticalIcon className="size-3.5" />
        {c.reason === "auto" ? "Conversation compacted automatically" : "Conversation compacted"} · {c.compactedMessages} messages summarised
        <ChevronRightIcon className={cn("size-3 transition-transform", open && "rotate-90")} />
        <span className="h-px flex-1 bg-border" />
      </button>
      {open && (
        <div className="mt-3 rounded-xl border bg-card/50 p-3">
          <Markdown className="text-[0.85rem]">{c.summary}</Markdown>
        </div>
      )}
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

type Group = { kind: "user"; message: ChatMessageDTO } | { kind: "assistant"; messages: ChatMessageDTO[] } | { kind: "compaction"; message: ChatMessageDTO };

function groupMessages(messages: ChatMessageDTO[]): Group[] {
  const groups: Group[] = [];
  for (const m of messages) {
    if (m.content.kind === "compaction") {
      groups.push({ kind: "compaction", message: m });
      continue;
    }
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
  subagents = {},
  status = null,
  projectId,
  onOpenBrowser,
}: {
  subagents?: Record<string, Record<string, SubAgentState>>;
  status?: string | null;
  projectId?: string;
  onOpenBrowser?: () => void;
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
        g.kind === "compaction" ? (
          <CompactionDivider key={g.message.id} message={g.message} />
        ) : g.kind === "user" ? (
          <motion.div key={g.message.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-end gap-1.5" data-slot="chat-message">
            {g.message.content.kind === "user" && g.message.content.attachments?.length ? (
              <div className="flex max-w-[88%] flex-wrap justify-end gap-1.5">
                {g.message.content.attachments.map((a) => (
                  // eslint-disable-next-line @next/next/no-img-element -- private attachment served by our API
                  <img key={a.id} src={`/api/attachments/${a.id}`} alt={a.name} className="size-20 rounded-lg border object-cover" loading="lazy" />
                ))}
              </div>
            ) : null}
            {g.message.content.kind === "user" && g.message.content.text && (
              <div className="max-w-[88%] rounded-2xl rounded-tr-md bg-secondary px-4 py-2.5 text-[0.92rem] leading-relaxed break-words whitespace-pre-wrap" data-testid="user-message">
                <LinkifiedText text={g.message.content.text} />
              </div>
            )}
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
                    if (p.name === "spawn_agents") {
                      const r = results[p.id];
                      return (
                        <SubAgentsCard
                          key={p.id}
                          live={subagents[p.id]}
                          stored={(r?.meta?.agents as { name: string; status: string; changed?: number; costMicros?: number }[] | undefined) ?? undefined}
                          planned={(p.input as { agents?: { name: string; task?: string }[] }).agents}
                        />
                      );
                    }
                    return <ToolRow key={p.id} name={p.name} input={p.input} result={results[p.id]} onOpenFile={onOpenFile} projectId={projectId} onOpenBrowser={onOpenBrowser} />;
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
          {streaming.tools.map((t) =>
            t.name === "spawn_agents" ? (
              <SubAgentsCard key={t.id} live={subagents[t.id]} planned={(peekInput(t.json) as { agents?: { name: string }[] }).agents} />
            ) : (
              <ToolRow key={t.id} name={t.name} input={peekInput(t.json)} result={results[t.id]} streaming onOpenFile={onOpenFile} projectId={projectId} onOpenBrowser={onOpenBrowser} />
            ),
          )}
        </div>
      )}

      {running && (!streaming || status) && (
        <div className="flex items-center gap-2 text-xs" aria-live="polite">
          <SparklesIcon className="size-3.5 text-primary" />
          <span className="shimmer-text">{status ?? "Working…"}</span>
        </div>
      )}
      <div ref={bottom} />
    </div>
  );
}
