"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLinkIcon, LoaderCircleIcon, UploadIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Status = { configured: boolean; connected: boolean; canRepo: boolean };
type Link = { repo: string | null; branch: string | null; pushedAt: string | null };

export async function connectGitHub(callbackURL: string) {
  const { error } = await authClient.linkSocial({ provider: "github", scopes: ["repo"], callbackURL });
  if (error) toast.error(error.message ?? "Couldn't connect GitHub");
}

export function GitHubDialog({ projectId, projectName, open, onOpenChange }: { projectId: string; projectName: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [link, setLink] = useState<Link | null>(null);
  const [repoName, setRepoName] = useState(projectName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, ""));
  const [priv, setPriv] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [s, l] = await Promise.all([fetch("/api/integrations/github").then((r) => r.json()), fetch(`/api/projects/${projectId}/github`).then((r) => r.json())]);
    setStatus(s);
    setLink(l);
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load when the dialog opens
    if (open) void load();
  }, [open, load]);

  const push = async () => {
    setBusy(true);
    const res = await fetch(`/api/projects/${projectId}/github`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repoName, private: priv, message: message || undefined }) });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return toast.error(data?.error?.message ?? "Push failed");
    toast.success(`Pushed ${data.commit} to ${data.repo}`, { action: { label: "Open", onClick: () => window.open(data.url, "_blank", "noopener") } });
    setMessage("");
    void load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BrandLogo id="github" className="size-5" /> GitHub
          </DialogTitle>
          <DialogDescription>Push the project&apos;s code to a repository you own. Each push is one commit with the current files. Environment files are never pushed.</DialogDescription>
        </DialogHeader>
        {!status || !link ? (
          <LoaderCircleIcon className="mx-auto my-6 size-5 animate-spin text-muted-foreground" />
        ) : !status.configured ? (
          <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">GitHub isn&apos;t connected to this Forged server yet. Coming soon. Meanwhile, download the ZIP and push it yourself.</p>
        ) : !status.connected || !status.canRepo ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{status.connected ? "Your GitHub connection doesn't include repository access yet." : "Connect your GitHub account to push code."} Forged asks for repository access only for this.</p>
            <Button variant="ember" onClick={() => connectGitHub(`/project/${projectId}?github=1`)}>
              <BrandLogo id="github" className="size-4" /> Connect GitHub
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {link.repo ? (
              <a href={`https://github.com/${link.repo}`} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 rounded-lg border bg-background/40 px-3 py-2 font-mono text-sm hover:bg-accent">
                {link.repo} <span className="text-muted-foreground">@ {link.branch}</span>
                <ExternalLinkIcon className="ml-auto size-3.5 text-muted-foreground" />
              </a>
            ) : (
              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label htmlFor="gh-repo">New repository name</Label>
                  <Input id="gh-repo" value={repoName} onChange={(e) => setRepoName(e.target.value.replace(/[^A-Za-z0-9._-]/g, "-"))} maxLength={90} className="font-mono" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={priv} onCheckedChange={setPriv} /> Private repository
                </label>
              </div>
            )}
            {link.pushedAt && <p className="text-xs text-muted-foreground">Last push {new Date(link.pushedAt).toLocaleString()}</p>}
            <div className="space-y-2">
              <Label htmlFor="gh-msg">Commit message</Label>
              <Input id="gh-msg" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Update from Forged.dev" maxLength={200} />
            </div>
            <Button variant="ember" onClick={push} disabled={busy || (!link.repo && !repoName)}>
              {busy ? <LoaderCircleIcon className="animate-spin" /> : <UploadIcon />} {link.repo ? "Push changes" : "Create repository and push"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
