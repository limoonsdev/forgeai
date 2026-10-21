"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ExternalLinkIcon, LoaderCircleIcon, MonitorIcon, PlayIcon, PowerIcon, RotateCwIcon, ServerOffIcon, SmartphoneIcon, TabletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import type { SandboxState } from "./use-agent";

const DEVICES = [
  { id: "desktop", icon: MonitorIcon, width: "100%" },
  { id: "tablet", icon: TabletIcon, width: "820px" },
  { id: "mobile", icon: SmartphoneIcon, width: "390px" },
] as const;

export function PreviewPanel({
  sandbox,
  available,
  refreshKey,
  onRefresh,
  onStart,
  onStop,
}: {
  sandbox: SandboxState;
  available: boolean;
  refreshKey: number;
  onRefresh: () => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const [device, setDevice] = useState<(typeof DEVICES)[number]["id"]>("desktop");
  const [route, setRoute] = useState("/");
  const [draft, setDraft] = useState("/");
  const url = sandbox.previewUrl ? `${sandbox.previewUrl.replace(/\/$/, "")}${route}` : null;
  const running = sandbox.status === "running" && url;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1.5 border-b px-2 py-1.5">
        <div className="flex rounded-lg border p-0.5">
          {DEVICES.map((d) => (
            <button
              key={d.id}
              onClick={() => setDevice(d.id)}
              className={cn("rounded-md p-1.5 text-muted-foreground transition", device === d.id && "bg-accent text-foreground")}
              aria-label={d.id}
            >
              <d.icon className="size-3.5" />
            </button>
          ))}
        </div>
        <form
          className="flex min-w-0 flex-1 items-center rounded-lg border bg-background/40 px-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            setRoute(draft.startsWith("/") ? draft : `/${draft}`);
            onRefresh();
          }}
        >
          <span className={cn("mr-2 size-1.5 shrink-0 rounded-full", running ? "bg-emerald-500" : sandbox.status === "starting" ? "animate-pulse bg-amber-500" : "bg-muted-foreground/40")} />
          <input value={draft} onChange={(e) => setDraft(e.target.value)} className="h-7 min-w-0 flex-1 bg-transparent font-mono text-xs outline-none" aria-label="Route" />
        </form>
        <Tooltip content="Refresh">
          <Button size="icon-xs" variant="ghost" onClick={onRefresh} disabled={!running}>
            <RotateCwIcon />
          </Button>
        </Tooltip>
        <Tooltip content="Open in a new tab">
          <Button size="icon-xs" variant="ghost" asChild disabled={!running}>
            <a href={url ?? "#"} target="_blank" rel="noreferrer">
              <ExternalLinkIcon />
            </a>
          </Button>
        </Tooltip>
        {running && (
          <Tooltip content="Stop the VM">
            <Button size="icon-xs" variant="ghost" onClick={onStop}>
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
              data-testid="preview-iframe"
            />
          </motion.div>
        ) : (
          <div className="relative flex flex-col items-center justify-center px-8 text-center">
            {!available ? (
              <>
                <ServerOffIcon className="size-8 text-muted-foreground" />
                <p className="mt-4 font-medium">Live preview is not enabled on this server</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Configure Docker or E2B (FORGED_SANDBOX_PROVIDER) to run projects in VMs. The code tab still works.
                </p>
              </>
            ) : sandbox.status === "starting" ? (
              <>
                <div className="relative">
                  <LogoMark glow className="size-16 animate-[float_3s_ease-in-out_infinite]" />
                </div>
                <p className="mt-6 flex items-center gap-2 font-medium">
                  <LoaderCircleIcon className="size-4 animate-spin text-primary" /> {sandbox.message ?? "Booting your VM…"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Spinning up an isolated Next.js environment.</p>
              </>
            ) : (
              <>
                <LogoMark className="size-14 opacity-80" />
                <p className="mt-5 font-medium">{sandbox.status === "error" ? "The VM could not start" : "Your VM is asleep"}</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {sandbox.status === "error" ? sandbox.message ?? "Please try again." : "Start it to see a live preview of your app. It boots automatically when the agent needs it."}
                </p>
                <Button variant="ember" className="mt-5" onClick={onStart} data-testid="start-vm">
                  <PlayIcon /> {sandbox.status === "error" ? "Retry" : "Start preview"}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
