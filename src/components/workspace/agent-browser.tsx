"use client";

import { useEffect, useState } from "react";
import { GlobeIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrowserView } from "./use-agent";

const VW = 1280;
const VH = 800;

/**
 * Live view of the browser the agent drives inside the VM. Between screenshots, the cursor glides
 * toward the point the agent is about to click, so the motion reads like a real hand on a mouse.
 */
export function AgentBrowser({ view, onClose }: { view: BrowserView; onClose: () => void }) {
  const [ripple, setRipple] = useState(0);
  const clicking = /click/i.test(view.label);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- replay the click ripple when a click lands
    if (clicking && !view.busy) setRipple((r) => r + 1);
  }, [view.at, clicking, view.busy]);

  const cx = view.cursor ? (view.cursor.x / VW) * 100 : 50;
  const cy = view.cursor ? (view.cursor.y / VH) * 100 : 50;

  return (
    <div className="flex h-full flex-col bg-surface" data-testid="agent-browser">
      <div className="flex items-center gap-2 border-b bg-card/70 px-3 py-2 text-xs">
        <span className="relative flex size-2">
          <span className={cn("absolute inline-flex size-full rounded-full bg-primary opacity-60", view.busy && "animate-ping")} />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
        <span className="font-medium">Agent is using the browser</span>
        <span className="min-w-0 truncate text-muted-foreground">· {view.label}</span>
        {view.busy && <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
        <button onClick={onClose} className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Back to your preview">
          <XIcon className="size-3.5" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <div className="w-full max-w-5xl overflow-hidden rounded-xl border bg-card shadow-2xl">
          <div className="flex items-center gap-2 border-b px-3 py-1.5">
            <span className="flex gap-1">
              <span className="size-2 rounded-full bg-foreground/15" />
              <span className="size-2 rounded-full bg-foreground/15" />
              <span className="size-2 rounded-full bg-foreground/15" />
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-background/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              <GlobeIcon className="size-3 shrink-0" />
              <span className="truncate">localhost:3000{view.url ?? "/"}</span>
            </span>
          </div>
          <div className="relative w-full bg-white" style={{ aspectRatio: `${VW} / ${VH}` }}>
            {view.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- base64 screenshot from the VM
              <img src={`data:image/jpeg;base64,${view.image}`} alt="What the agent sees" className="absolute inset-0 size-full object-cover object-top" draggable={false} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-surface text-sm text-muted-foreground">
                <LoaderCircleIcon className="mr-2 size-4 animate-spin" /> Opening the page…
              </div>
            )}
            <div
              className="pointer-events-none absolute z-10 transition-[left,top] duration-700 ease-[cubic-bezier(0.65,0,0.35,1)]"
              style={{ left: `${cx}%`, top: `${cy}%` }}
              aria-hidden
            >
              {ripple > 0 && <span key={ripple} className="absolute -top-4 -left-4 size-8 animate-[cursor-ripple_0.6s_ease-out_forwards] rounded-full border-2 border-primary" />}
              <svg viewBox="0 0 24 24" className="size-5 -translate-x-[3px] -translate-y-[2px] drop-shadow-[0_2px_3px_rgb(0_0_0/0.45)]">
                <path d="M4 2l16 9.5-7 1.6L9.6 20z" fill="white" stroke="black" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <span className="absolute top-5 left-4 rounded-md bg-primary px-1.5 py-0.5 font-mono text-[10px] font-semibold whitespace-nowrap text-primary-foreground shadow">Forged</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
