"use client";

import { CheckIcon, CircleDashedIcon, ListChecksIcon, LoaderCircleIcon } from "lucide-react";
import type { PlanItem } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

export function PlanCard({ items, running }: { items: PlanItem[]; running: boolean }) {
  const done = items.filter((i) => i.status === "done").length;
  return (
    <div className="rounded-xl border bg-card/80 p-3 backdrop-blur" data-testid="plan-card">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <ListChecksIcon className="size-3.5 text-primary" /> Plan
        <span className="ml-auto tabular-nums">
          {done}/{items.length}
        </span>
      </div>
      <div className="space-y-1">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 text-[13px]">
            {it.status === "done" ? (
              <CheckIcon className="size-3.5 shrink-0 text-emerald-500" />
            ) : it.status === "in_progress" && running ? (
              <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin text-primary" />
            ) : (
              <CircleDashedIcon className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className={cn("truncate", it.status === "done" && "text-muted-foreground line-through")}>{it.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
