"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  ExternalLinkIcon,
  GaugeIcon,
  HourglassIcon,
  LoaderCircleIcon,
  MonitorIcon,
  MousePointer2Icon,
  PlayIcon,
  PowerIcon,
  RefreshCcwIcon,
  RotateCwIcon,
  ServerOffIcon,
  SmartphoneIcon,
  TabletIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import type { SandboxState } from "./use-agent";

const DEVICES = [
  { id: "desktop", icon: MonitorIcon, width: "100%", label: "Desktop" },
  { id: "tablet", icon: TabletIcon, width: "820px", label: "Tablet" },
  { id: "mobile", icon: SmartphoneIcon, width: "390px", label: "Phone" },
] as const;

function eta(seconds: number) {
  if (seconds < 60) return "less than a minute";
  const m = Math.round(seconds / 60);
  return `about ${m} minute${m > 1 ? "s" : ""}`;
}

export function PreviewPanel({
  sandbox,
  available,
  refreshKey,
  onRefresh,
  onStart,
  onStop,
  onRestart,
  onAudit,
  auditing,
  agentViewAvailable,
  onShowAgentView,
  route,
  onRouteChange,
}: {
  sandbox: SandboxState;
  available: boolean;
  refreshKey: number;
  onRefresh: () => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onAudit: () => void;
  auditing: boolean;
  agentViewAvailable: boolean;
  onShowAgentView: () => void;
  route: string;
  onRouteChange: (r: string) => void;
}) {
  const [device, setDevice] = useState<(typeof DEVICES)[number]["id"]>("desktop");
  const [draft, setDraft] = useState(route);
  const url = sandbox.previewUrl ? `${sandbox.previewUrl.replace(/\/$/, "")}${route}` : null;
  const running = sandbox.status === "running" && Boolean(url);
  const busy = sandbox.status === "starting" || sandbox.status === "restarting";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <div className="flex rounded-lg border p-0.5">
          {DEVICES.map((d) => (
            <Tooltip key={d.id} content={d.label}>
              <button onClick={() => setDevice(d.id)} className={cn("rounded-md p-1.5 text-muted-foreground transition", device === d.id && "bg-accent text-foreground")} aria-label={d.label} aria-pressed={device === d.id}>
                <d.icon className="size-3.5" />
              </button>
            </Tooltip>
          ))}
        </div>
        <form
          className="flex min-w-0 flex-1 items-center rounded-lg border bg-background/40 px-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            onRouteChange(draft.startsWith("/") ? draft : `/${draft}`);
          }}
        >
          <span className={cn("mr-2 size-1.5 shrink-0 rounded-full", running ? "bg-success" : busy || sandbox.status === "queued" ? "animate-pulse bg-amber-500" : "bg-muted-foreground/40")} />
          <input value={draft} onChange={(e) => setDraft(e.target.value)} className="h-7 min-w-0 flex-1 bg-transparent font-mono text-xs outline-none" aria-label="Page path" spellCheck={false} />
        </form>
        <Tooltip content="Refresh the preview">
          <Button size="icon-xs" variant="ghost" onClick={onRefresh} disabled={!running} aria-label="Refresh the preview" data-testid="refresh-preview">
            <RotateCwIcon />
          </Button>
        </Tooltip>
        <Tooltip content="Restart the VM (dev server and processes)">
          <Button size="icon-xs" variant="ghost" onClick={onRestart} disabled={!running} aria-label="Restart the VM" data-testid="restart-vm">
            <RefreshCcwIcon />
          </Button>
        </Tooltip>
        <Tooltip content="Audit this page: performance, accessibility, SEO">
          <Button size="icon-xs" variant="ghost" onClick={onAudit} disabled={!running || auditing} aria-label="Audit this page" data-testid="audit-page">
            {auditing ? <LoaderCircleIcon className="animate-spin" /> : <GaugeIcon />}
          </Button>
        </Tooltip>
        {agentViewAvailable && (
          <Tooltip content="Show what the agent sees">
            <Button size="icon-xs" variant="ghost" onClick={onShowAgentView} aria-label="Show the agent's browser">
              <MousePointer2Icon />
            </Button>
          </Tooltip>
        )}
        <Tooltip content="Open in a new tab">
          <Button size="icon-xs" variant="ghost" asChild disabled={!running}>
            <a href={url ?? "#"} target="_blank" rel="noreferrer noopener" aria-label="Open in a new tab">
              <ExternalLinkIcon />
            </a>
          </Button>
        </Tooltip>
        {running && (
          <Tooltip content="Stop the VM">
            <Button size="icon-xs" variant="ghost" onClick={onStop} aria-label="Stop the VM">
              <PowerIcon />
            </Button>
          </Tooltip>
        )}
      </div>
      <div className="relative flex flex-1 justify-center overflow-hidden bg-surface">
        <div className="bg-dots absolute inset-0 opacity-50" />
        {running ? (
          <motion.div
            layout
            className={cn("relative h-full bg-white", device !== "desktop" && "my-4 h-[calc(100%-2rem)] overflow-hidden rounded-2xl border shadow-2xl")}
            style={{ width: DEVICES.find((d) => d.id === device)!.width, maxWidth: "100%" }}
          >
            <iframe
              key={`${refreshKey}-${route}`}
              src={url!}
              title="App preview"
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
              referrerPolicy="no-referrer"
              data-testid="preview-iframe"
            />
          </motion.div>
        ) : (
          <div className="relative flex flex-col items-center justify-center px-8 text-center" aria-live="polite">
            {!available ? (
              <>
                <ServerOffIcon className="size-8 text-muted-foreground" />
                <p className="mt-4 font-medium">Live previews aren&apos;t available right now</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">You can still chat with the agent and read the code. Previews come back as soon as the VM service is up.</p>
              </>
            ) : sandbox.status === "queued" ? (
              <>
                <HourglassIcon className="size-8 text-primary" />
                <p className="mt-5 font-display text-lg font-bold">The servers are busy</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {sandbox.queue ? (
                    <>
                      You&apos;re <span className="font-semibold text-foreground">#{sandbox.queue.position}</span> in line. Your preview should start in {eta(sandbox.queue.etaSeconds)}.
                    </>
                  ) : (
                    "You're in line. Your preview starts automatically."
                  )}
                </p>
                <div className="mt-5 h-1 w-56 overflow-hidden rounded-full bg-muted">
                  <div className="heat-line h-full w-1/3 animate-[queue-slide_1.6s_ease-in-out_infinite]" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Keep this tab open. You can keep chatting while you wait.</p>
              </>
            ) : busy ? (
              <>
                <LogoMark glow className="size-16 animate-[float_3s_ease-in-out_infinite]" />
                <p className="mt-6 flex items-center gap-2 font-medium">
                  <LoaderCircleIcon className="size-4 animate-spin text-primary" /> {sandbox.message ?? (sandbox.status === "restarting" ? "Restarting your VM…" : "Starting your VM…")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Installing packages and starting the Next.js dev server.</p>
              </>
            ) : (
              <>
                <LogoMark className="size-14 opacity-80" />
                <p className="mt-5 font-medium">{sandbox.status === "error" ? "The VM couldn't start" : "Your VM is asleep"}</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {sandbox.status === "error" ? (sandbox.message ?? "Please try again.") : "Start it to see a live preview. It also starts on its own when the agent needs it."}
                </p>
                <Button variant="ember" className="mt-5" onClick={onStart} data-testid="start-vm">
                  <PlayIcon /> {sandbox.status === "error" ? "Try again" : "Start preview"}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
