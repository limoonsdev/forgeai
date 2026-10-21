"use client";

import { CheckIcon, LoaderCircleIcon, UsersIcon, XIcon } from "lucide-react";
import { cn, formatCredits } from "@/lib/utils";
import type { SubAgentState } from "./use-agent";

type Stored = { name: string; status: string; changed?: number; costMicros?: number };

/** Live status of the helpers spawned by spawn_agents (from events while running, from the result afterwards). */
export function SubAgentsCard({ live, stored, planned }: { live?: Record<string, SubAgentState>; stored?: Stored[]; planned?: { name: string; task?: string }[] }) {
  const rows: { key: string; name: string; status: string; label?: string; steps?: number; costMicros?: number; changed?: number }[] = live
    ? Object.values(live).map((a) => ({ key: a.taskId, ...a }))
    : stored
      ? stored.map((a, i) => ({ key: String(i), ...a }))
      : (planned ?? []).map((a, i) => ({ key: String(i), name: a.name, status: "queued", label: a.task }));
  if (!rows.length) return null;
  const done = rows.filter((r) => r.status === "done").length;
  return (
    <div className="rounded-xl border bg-background/40 p-3 text-[12.5px]" data-testid="subagents-card">
      <div className="mb-2 flex items-center gap-2 font-medium">
        <UsersIcon className="size-3.5 text-primary" /> {rows.length} sub-agents
        <span className="ml-auto font-mono text-[10.5px] text-muted-foreground">
          {done}/{rows.length} done
        </span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2 rounded-lg border bg-card/50 px-2.5 py-1.5">
            {r.status === "done" ? (
              <CheckIcon className="size-3.5 shrink-0 text-success" />
            ) : r.status === "failed" || r.status === "error" ? (
              <XIcon className="size-3.5 shrink-0 text-destructive" />
            ) : r.status === "queued" ? (
              <span className="size-3.5 shrink-0 rounded-full border border-dashed border-muted-foreground/50" />
            ) : (
              <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin text-primary" />
            )}
            <span className="shrink-0 font-medium">{r.name}</span>
            <span className={cn("min-w-0 truncate text-muted-foreground", r.status === "running" && "shimmer-text")}>{r.label ?? (r.changed !== undefined ? `${r.changed} file${r.changed === 1 ? "" : "s"} changed` : "")}</span>
            <span className="ml-auto shrink-0 font-mono text-[10.5px] text-muted-foreground">
              {r.steps ? `${r.steps} steps` : ""}
              {r.costMicros ? ` · ${formatCredits(r.costMicros, { precise: true })}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
