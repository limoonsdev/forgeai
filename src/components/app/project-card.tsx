"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CircleDotIcon, CopyIcon, DownloadIcon, ExternalLinkIcon, MoreHorizontalIcon, PencilIcon, Share2Icon, Trash2Icon } from "lucide-react";
import type { ProjectDTO } from "@/lib/server/projects";
import { getModel } from "@/lib/ai/models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { formatCredits, timeAgo } from "@/lib/utils";

const GRADIENTS = [
  "from-orange-500/40 via-rose-500/20 to-transparent",
  "from-violet-500/40 via-sky-500/20 to-transparent",
  "from-emerald-500/40 via-teal-500/20 to-transparent",
  "from-amber-400/40 via-orange-500/20 to-transparent",
  "from-sky-500/40 via-indigo-500/20 to-transparent",
  "from-pink-500/40 via-fuchsia-500/20 to-transparent",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function ProjectCard({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(project.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const gradient = GRADIENTS[hash(project.id) % GRADIENTS.length];
  const model = getModel(project.model);

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) toast.error("Could not update the project");
    router.refresh();
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card/60 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_20px_60px_-30px_rgba(255,106,26,0.4)]">
      <Link href={`/project/${project.id}`} className="block">
        <div className={`relative h-32 bg-gradient-to-br ${gradient}`}>
          <div className="bg-dots absolute inset-0 opacity-40" />
          <span className="absolute bottom-3 left-4 text-4xl font-semibold tracking-tight text-foreground/90">{project.name.slice(0, 1).toUpperCase()}</span>
          {project.status === "running" && (
            <Badge className="absolute top-3 left-3 bg-background/70 text-primary backdrop-blur">
              <CircleDotIcon className="animate-pulse" /> Forging
            </Badge>
          )}
          {project.status === "awaiting_input" && <Badge variant="warning" className="absolute top-3 left-3 bg-background/70 backdrop-blur">Needs your answer</Badge>}
        </div>
        <div className="p-4">
          <h3 className="truncate font-medium">{project.name}</h3>
          <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">{project.description || "No description yet"}</p>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{timeAgo(project.updatedAt)}</span>
            {model && <span className="truncate">· {model.label}</span>}
            <span className="ml-auto tabular-nums">{formatCredits(project.totalCostMicros, { precise: true })}</span>
          </div>
        </div>
      </Link>
      <div className="absolute top-2 right-2 opacity-0 transition group-hover:opacity-100 has-[[data-state=open]]:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="secondary" className="bg-background/70 backdrop-blur" aria-label="Project actions">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => router.push(`/project/${project.id}`)}>
              <ExternalLinkIcon /> Open
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setRenaming(true)}>
              <PencilIcon /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={async () => {
                const res = await fetch(`/api/projects/${project.id}/share`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ enabled: true }),
                });
                const data = await res.json();
                if (data.url) {
                  await navigator.clipboard.writeText(data.url).catch(() => {});
                  toast.success("Share link copied", { description: data.url });
                }
                router.refresh();
              }}
            >
              {project.share.enabled ? <CopyIcon /> : <Share2Icon />} {project.share.enabled ? "Copy share link" : "Share session"}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`/api/projects/${project.id}/export`}>
                <DownloadIcon /> Download code
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
              <Trash2Icon /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
            <Button
              variant="ember"
              onClick={async () => {
                await patch({ name });
                setRenaming(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{project.name}”?</DialogTitle>
            <DialogDescription>The code, the conversation and the VM will be permanently deleted.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
                if (res.ok) toast.success("Project deleted");
                setConfirmDelete(false);
                router.refresh();
              }}
            >
              Delete forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
