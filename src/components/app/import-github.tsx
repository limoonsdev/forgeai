"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoaderCircleIcon, LockIcon, SearchIcon } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { connectGitHub } from "@/components/workspace/github-dialog";

type Repo = { fullName: string; private: boolean; defaultBranch: string; updatedAt: string; description: string | null };
type State = { configured: boolean; connected: boolean; canRepo: boolean; repos?: Repo[] };

export function ImportGitHub() {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("import") === "github");
  const [state, setState] = useState<State | null>(null);
  const [q, setQ] = useState("");
  const [importing, setImporting] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/integrations/github?repos=1")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error?.message);
        setState(data);
      })
      .catch((e) => {
        toast.error((e as Error).message || "Couldn't reach GitHub");
        setState({ configured: true, connected: true, canRepo: true, repos: [] });
      });
  }, [open]);

  const repos = (state?.repos ?? []).filter((r) => r.fullName.toLowerCase().includes(q.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BrandLogo id="github" className="size-4" /> Import from GitHub
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import a GitHub repository</DialogTitle>
          <DialogDescription>Next.js projects only. Files are copied into a new Forged project; .env files and build folders are skipped.</DialogDescription>
        </DialogHeader>
        {!state ? (
          <LoaderCircleIcon className="mx-auto my-6 size-5 animate-spin text-muted-foreground" />
        ) : !state.configured ? (
          <p className="text-sm text-muted-foreground">GitHub isn&apos;t connected to this Forged server yet. Coming soon.</p>
        ) : !state.connected || !state.canRepo ? (
          <Button variant="ember" onClick={() => connectGitHub("/dashboard?import=github")}>
            <BrandLogo id="github" className="size-4" /> Connect GitHub
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your repositories" className="pl-9" autoFocus />
            </div>
            <div className="max-h-80 space-y-1 overflow-y-auto pr-1 scrollbar-thin">
              {repos.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No repositories found.</p>}
              {repos.map((r) => (
                <button
                  key={r.fullName}
                  disabled={importing !== null}
                  onClick={async () => {
                    setImporting(r.fullName);
                    const res = await fetch("/api/integrations/github/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repo: r.fullName }) });
                    const data = await res.json().catch(() => null);
                    if (!res.ok) {
                      setImporting(null);
                      return toast.error(data?.error?.message ?? "Import failed");
                    }
                    toast.success(`Imported ${data.files} files`);
                    router.push(`/project/${data.projectId}`);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-accent disabled:opacity-60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-mono text-sm">
                      {r.fullName} {r.private && <LockIcon className="size-3 text-muted-foreground" />}
                    </p>
                    {r.description && <p className="truncate text-xs text-muted-foreground">{r.description}</p>}
                  </div>
                  {importing === r.fullName ? <LoaderCircleIcon className="size-4 animate-spin" /> : <span className="text-xs text-muted-foreground">{new Date(r.updatedAt).toLocaleDateString()}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
