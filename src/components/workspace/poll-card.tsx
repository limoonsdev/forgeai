"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { CheckIcon, MessageCircleQuestionIcon, SendIcon } from "lucide-react";
import type { PollInput } from "@/lib/ai/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Interactive poll the agent sends with the ask_user tool. */
export function PollCard({
  poll,
  active,
  answer,
  skipped,
  onAnswer,
}: {
  poll: PollInput;
  active: boolean;
  answer?: string;
  skipped?: boolean;
  onAnswer?: (answer: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const multi = Boolean(poll.multiSelect);

  const toggle = (label: string) => {
    if (!active) return;
    setSelected((s) => (multi ? (s.includes(label) ? s.filter((x) => x !== label) : [...s, label]) : [label]));
  };

  const submit = () => {
    const parts = [...selected];
    if (custom.trim()) parts.push(custom.trim());
    if (!parts.length) return;
    onAnswer?.(parts.join(" + "));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-2xl border bg-card p-4", active && "border-primary/40 shadow-[0_10px_40px_-20px_rgba(255,106,26,0.6)]")}
      data-testid="poll-card"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/15">
          <MessageCircleQuestionIcon className="size-3.5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{poll.question}</p>
          {multi && active && <p className="mt-0.5 text-xs text-muted-foreground">Select all that apply</p>}
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {poll.options.map((o) => {
          const chosen = active ? selected.includes(o.label) : Boolean(answer?.split(" + ").includes(o.label));
          return (
            <button
              key={o.label}
              type="button"
              disabled={!active}
              onClick={() => toggle(o.label)}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                active && "hover:border-primary/40 hover:bg-accent/50",
                chosen && "border-primary/60 bg-primary/10",
                !active && !chosen && "opacity-55",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center border transition",
                  multi ? "rounded-[5px]" : "rounded-full",
                  chosen ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                )}
              >
                {chosen && <CheckIcon className="size-3" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{o.label}</span>
                {o.description && <span className="block text-xs text-muted-foreground">{o.description}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {active ? (
        <div className="mt-3 flex gap-2">
          {poll.allowCustom !== false && (
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Or type your own answer…"
              className="h-9 min-w-0 flex-1 rounded-lg border bg-background/50 px-3 text-sm outline-none focus:border-primary/50"
            />
          )}
          <Button variant="ember" size="sm" className="h-9" onClick={submit} disabled={!selected.length && !custom.trim()} data-testid="poll-submit">
            <SendIcon /> Answer
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          {skipped ? "Skipped" : answer ? (
            <>
              You answered: <span className="text-foreground">{answer}</span>
            </>
          ) : (
            "Waiting for your answer"
          )}
        </p>
      )}
    </motion.div>
  );
}
