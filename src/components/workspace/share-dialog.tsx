"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckIcon, CopyIcon, GlobeIcon, LoaderCircleIcon, RefreshCwIcon, Share2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export type ShareState = { enabled: boolean; allowRemix: boolean; url: string | null };

export function ShareDialog({ projectId, initial }: { projectId: string; initial: ShareState }) {
  const [state, setState] = useState<ShareState>(initial);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const update = async (body: { enabled: boolean; allowRemix?: boolean; regenerate?: boolean }) => {
    setBusy(true);
    const res = await fetch(`/api/v1/projects/${projectId}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return toast.error(data?.error?.message ?? "Could not update sharing");
    setState({ enabled: data.enabled, allowRemix: data.allowRemix, url: data.url });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8" data-testid="share-button">
          <Share2Icon /> Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share this session</DialogTitle>
          <DialogDescription>Anyone with the link can watch the conversation, browse the code and remix the project.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div className="flex items-center gap-3">
              <GlobeIcon className="size-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Public link</p>
                <p className="text-xs text-muted-foreground">Read-only — your credits are never used by viewers.</p>
              </div>
            </div>
            <Switch checked={state.enabled} disabled={busy} onCheckedChange={(v) => update({ enabled: v, allowRemix: state.allowRemix })} data-testid="share-toggle" />
          </div>
          {state.enabled && (
            <>
              <div className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <p className="text-sm font-medium">Allow remix</p>
                  <p className="text-xs text-muted-foreground">Viewers can copy the code into their own project.</p>
                </div>
                <Switch checked={state.allowRemix} disabled={busy} onCheckedChange={(v) => update({ enabled: true, allowRemix: v })} />
              </div>
              <div className="flex gap-2">
                <input readOnly value={state.url ?? ""} className="h-9 min-w-0 flex-1 rounded-lg border bg-background/50 px-3 font-mono text-xs" data-testid="share-url" />
                <Button
                  size="sm"
                  variant="ember"
                  className="h-9"
                  onClick={async () => {
                    if (!state.url) return;
                    await navigator.clipboard.writeText(state.url).catch(() => {});
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => update({ enabled: true, regenerate: true })}>
                {busy ? <LoaderCircleIcon className="size-3 animate-spin" /> : <RefreshCwIcon className="size-3" />} Reset link (the old one stops working)
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
