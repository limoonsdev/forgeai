"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2Icon, ChevronRightIcon, CopyIcon, ExternalLinkIcon, GlobeIcon, LoaderCircleIcon, RocketIcon, XCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Deployment = { subdomain: string; url: string | null; status: "queued" | "building" | "live" | "failed" | "stopped"; log?: string; lastDeployedAt?: string | null };

export function PublishDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [dep, setDep] = useState<Deployment | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const working = dep?.status === "queued" || dep?.status === "building";

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/deploy`).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (res?.ok) setDep(data.deployment);
    setLoaded(true);
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load when opened
    if (open) void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open || !working) return;
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [open, working, refresh]);

  const publish = async () => {
    setBusy(true);
    const res = await fetch(`/api/projects/${projectId}/deploy`, { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return toast.error(data?.error?.message ?? "Couldn't publish");
    setDep(data.deployment);
    setShowLog(true);
  };

  const unpublish = async () => {
    setBusy(true);
    await fetch(`/api/projects/${projectId}/deploy`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    setDep(null);
    toast.success("App unpublished");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ember" className="h-8" data-testid="publish-button">
          <RocketIcon /> <span className="hidden sm:inline">Publish</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish your app</DialogTitle>
          <DialogDescription>Builds a production version and serves it on its own address with HTTPS. Republish whenever you want: the current version stays online until the new one is ready.</DialogDescription>
        </DialogHeader>
        {!loaded ? (
          <LoaderCircleIcon className="mx-auto my-6 size-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-4">
            {dep && (
              <div className="rounded-xl border bg-background/40 p-3">
                <div className="flex items-center gap-2 font-mono text-sm">
                  <GlobeIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate">{dep.url?.replace(/^https:\/\//, "") ?? dep.subdomain}</span>
                  {dep.url && (
                    <button
                      className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      onClick={() => {
                        void navigator.clipboard.writeText(dep.url!);
                        toast.success("Address copied");
                      }}
                      aria-label="Copy address"
                    >
                      <CopyIcon className="size-3.5" />
                    </button>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  {dep.status === "live" ? (
                    <span className="flex items-center gap-1.5 text-success">
                      <CheckCircle2Icon className="size-3.5" /> Live{dep.lastDeployedAt && <span className="text-muted-foreground">· published {new Date(dep.lastDeployedAt).toLocaleString()}</span>}
                    </span>
                  ) : dep.status === "failed" ? (
                    <span className="flex items-center gap-1.5 text-destructive">
                      <XCircleIcon className="size-3.5" /> The build failed. Check the log, or ask the agent to fix the build.
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <LoaderCircleIcon className="size-3.5 animate-spin" /> {dep.status === "queued" ? "Waiting for a build slot…" : "Building…"}
                    </span>
                  )}
                </div>
                {dep.log && (
                  <>
                    <button onClick={() => setShowLog((s) => !s)} className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <ChevronRightIcon className={cn("size-3 transition-transform", showLog && "rotate-90")} /> Build log
                    </button>
                    {showLog && <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-iron p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground scrollbar-thin">{dep.log}</pre>}
                  </>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="ember" onClick={publish} disabled={busy || working} data-testid="publish-run">
                {busy || working ? <LoaderCircleIcon className="animate-spin" /> : <RocketIcon />} {dep ? "Republish" : "Publish"}
              </Button>
              {dep?.status === "live" && dep.url && (
                <Button variant="outline" asChild>
                  <a href={dep.url} target="_blank" rel="noreferrer noopener">
                    <ExternalLinkIcon /> Open
                  </a>
                </Button>
              )}
              {dep && (
                <Button variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={unpublish} disabled={busy}>
                  Unpublish
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Published apps must follow the Acceptable Use Policy and show a small “Built with Forged” badge.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
