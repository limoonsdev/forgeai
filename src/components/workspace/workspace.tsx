"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { toast } from "sonner";
import { ArrowLeftIcon, CodeIcon, DownloadIcon, GiftIcon, MessageSquareIcon, MonitorIcon, MoreHorizontalIcon, PowerIcon, Trash2Icon } from "lucide-react";
import type { PublicModel } from "@/lib/ai/catalog";
import type { ChatMessageDTO } from "@/lib/ai/types";
import { CreditsPill } from "@/components/shared/credits-pill";
import { PromptComposer, type ComposerHandle } from "@/components/shared/prompt-composer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogoMark } from "@/components/brand/logo";
import { cn, formatCredits } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";
import { ChatMessages } from "./chat";
import { CodePanel } from "./code-panel";
import { PlanCard } from "./plan-card";
import { PreviewPanel } from "./preview-panel";
import { ShareDialog, type ShareState } from "./share-dialog";
import { useAgent, type SandboxState } from "./use-agent";

export type WorkspaceProps = {
  project: { id: string; name: string; description: string; status: string; model: string; tokenSaver: boolean };
  messages: ChatMessageDTO[];
  running: boolean;
  models: PublicModel[];
  balance: number;
  files: string[];
  sandbox: SandboxState;
  sandboxAvailable: boolean;
  share: ShareState;
};

export function Workspace(props: WorkspaceProps) {
  const router = useRouter();
  const [name, setName] = useState(props.project.name);
  const [editingName, setEditingName] = useState(false);
  const [balance, setBalance] = useState(props.balance);
  const [model, setModel] = useState(props.project.model);
  const [tokenSaver, setTokenSaver] = useState(props.project.tokenSaver);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState(props.files);
  const [selected, setSelected] = useState<string | null>(props.files.includes("app/page.tsx") ? "app/page.tsx" : props.files[0] ?? null);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [fileVersion, setFileVersion] = useState(0);
  const [sandbox, setSandbox] = useState<SandboxState>(props.sandbox);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [mobileView, setMobileView] = useState<"chat" | "preview" | "code">("chat");
  const [outOfCredits, setOutOfCredits] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const composer = useRef<ComposerHandle>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const refreshFiles = useCallback(async () => {
    const res = await fetch(`/api/v1/projects/${props.project.id}/files`);
    if (res.ok) {
      const data = (await res.json()) as { files: { path: string }[] };
      setFiles(data.files.map((f) => f.path));
    }
  }, [props.project.id]);

  const agent = useAgent(
    props.project.id,
    { messages: props.messages, running: props.running },
    {
      onFilesChanged: (paths, deleted) => {
        setChanged((c) => new Set([...c, ...paths]));
        if (paths.some((p) => !files.includes(p)) || deleted.length) void refreshFiles();
        if (selectedRef.current && paths.includes(selectedRef.current)) setFileVersion((v) => v + 1);
      },
      onProject: (p) => {
        if (p.name) setName(p.name);
      },
      onSandbox: (s) => {
        setSandbox((prev) => ({ status: s.status, previewUrl: s.previewUrl ?? prev.previewUrl, message: s.message === "refresh" ? prev.message : s.message }));
        if (s.refresh) setRefreshKey((k) => k + 1);
      },
      onBalance: setBalance,
      onOutOfCredits: () => setOutOfCredits(true),
    },
  );

  // Keep the VM warm while the workspace is open.
  useEffect(() => {
    if (!props.sandboxAvailable || props.sandbox.status !== "running") return;
    void fetch(`/api/v1/projects/${props.project.id}/sandbox`, { method: "POST" }).then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setSandbox({ status: "running", previewUrl: data.previewUrl });
      } else setSandbox({ status: "stopped", previewUrl: null });
    });
  }, [props.project.id, props.sandboxAvailable, props.sandbox.status]);

  const startSandbox = async () => {
    setSandbox((s) => ({ ...s, status: "starting", message: "Booting your VM…" }));
    const res = await fetch(`/api/v1/projects/${props.project.id}/sandbox`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setSandbox({ status: "running", previewUrl: data.previewUrl });
      setRefreshKey((k) => k + 1);
    } else setSandbox({ status: "error", previewUrl: null, message: data?.error?.message });
  };

  const stopSandbox = async () => {
    await fetch(`/api/v1/projects/${props.project.id}/sandbox`, { method: "DELETE" });
    setSandbox({ status: "stopped", previewUrl: null });
  };

  const submit = async () => {
    const text = input.trim();
    if (!text || agent.running) return;
    setInput("");
    const ok = await agent.send({ prompt: text, model, tokenSaver });
    if (!ok) setInput(text);
  };

  const saveName = async () => {
    setEditingName(false);
    if (!name.trim() || name === props.project.name) return;
    await fetch(`/api/v1/projects/${props.project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
  };

  const persistModel = (id: string) => {
    setModel(id);
    void fetch(`/api/v1/projects/${props.project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: id }) });
  };
  const persistSaver = (v: boolean) => {
    setTokenSaver(v);
    void fetch(`/api/v1/projects/${props.project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tokenSaver: v }) });
  };

  const openFile = (path: string) => {
    setSelected(path);
    setTab("code");
    setMobileView("code");
  };

  const chatPanel = (
    <div className="flex h-full min-h-0 flex-col">
      {agent.messages.length === 0 && !agent.running ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <LogoMark glow className="size-14" />
          <p className="mt-4 font-medium">What should we forge?</p>
          <p className="mt-1 text-sm text-muted-foreground">Describe your app, a page, or a change. The agent takes it from there.</p>
        </div>
      ) : (
        <ChatMessages
          messages={agent.messages}
          streaming={agent.streaming}
          results={agent.results}
          pendingPollId={agent.pendingPoll?.toolCallId ?? null}
          running={agent.running}
          onOpenFile={openFile}
          onAnswerPoll={(toolCallId, answer) => void agent.send({ pollAnswer: { toolCallId, answer }, model, tokenSaver })}
        />
      )}
      <div className="space-y-2 border-t bg-background/60 p-3 backdrop-blur">
        {agent.plan && agent.running && <PlanCard items={agent.plan} running={agent.running} />}
        {agent.running && agent.runCost > 0 && (
          <div className="flex justify-end text-[11px] text-muted-foreground tabular-nums">This run: {formatCredits(agent.runCost, { precise: true })}</div>
        )}
        <PromptComposer
          ref={composer}
          value={input}
          onChange={setInput}
          onSubmit={submit}
          onStop={agent.stop}
          running={agent.running}
          models={props.models}
          model={model}
          onModelChange={persistModel}
          tokenSaver={tokenSaver}
          onTokenSaverChange={persistSaver}
          placeholder={agent.pendingPoll ? "Answer the question above, or type your own reply…" : "Ask Forged to build or change anything…"}
        />
      </div>
    </div>
  );

  const rightPanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="hidden items-center gap-1 border-b px-2 py-1.5 md:flex">
        {(["preview", "code"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition", tab === t && "bg-accent text-foreground")}
            data-testid={`tab-${t}`}
          >
            {t === "preview" ? <MonitorIcon className="size-3.5" /> : <CodeIcon className="size-3.5" />}
            {t === "preview" ? "Preview" : "Code"}
          </button>
        ))}
        <span className="ml-auto pr-2 text-[11px] text-muted-foreground">
          {sandbox.status === "running" ? "next dev · VM running" : sandbox.status === "starting" ? "VM booting…" : "VM asleep"}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        {(isDesktop ? tab === "preview" : mobileView === "preview") ? (
          <PreviewPanel
            sandbox={sandbox}
            available={props.sandboxAvailable}
            refreshKey={refreshKey}
            onRefresh={() => setRefreshKey((k) => k + 1)}
            onStart={startSandbox}
            onStop={stopSandbox}
          />
        ) : (
          <CodePanel projectId={props.project.id} files={files} selected={selected} onSelect={setSelected} changed={changed} externalVersion={fileVersion} />
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2 sm:px-3">
        <Button asChild size="icon-sm" variant="ghost" aria-label="Back to dashboard">
          <Link href="/dashboard">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <LogoMark className="size-5" />
        {editingName ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            className="h-8 w-56 rounded-md border bg-background px-2 text-sm font-medium outline-none"
            maxLength={60}
          />
        ) : (
          <button onClick={() => setEditingName(true)} className="max-w-[40vw] truncate rounded-md px-1.5 py-1 text-sm font-medium hover:bg-accent" data-testid="project-name">
            {name}
          </button>
        )}
        {agent.running && (
          <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" /> Forging
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <CreditsPill micros={balance} className="hidden sm:inline-flex" />
          <ShareDialog projectId={props.project.id} initial={props.share} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label="More">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a href={`/api/v1/projects/${props.project.id}/export`}>
                  <DownloadIcon /> Download code (.zip)
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={stopSandbox}>
                <PowerIcon /> Stop VM
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                <Trash2Icon /> Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile switcher */}
      <div className="flex border-b md:hidden">
        {(["chat", "preview", "code"] as const).map((v) => (
          <button key={v} onClick={() => setMobileView(v)} className={cn("flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium text-muted-foreground", mobileView === v && "border-b-2 border-primary text-foreground")}>
            {v === "chat" ? <MessageSquareIcon className="size-3.5" /> : v === "preview" ? <MonitorIcon className="size-3.5" /> : <CodeIcon className="size-3.5" />}
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {isDesktop ? (
          <Group orientation="horizontal" className="h-full">
            <Panel defaultSize="36" minSize={340} className="min-w-0">
              {chatPanel}
            </Panel>
            <Separator className="w-px bg-border transition-colors data-[separator]:hover:bg-primary/60" />
            <Panel minSize={360} className="min-w-0">
              {rightPanel}
            </Panel>
          </Group>
        ) : (
          <div className="h-full">{mobileView === "chat" ? chatPanel : rightPanel}</div>
        )}
      </div>

      <Dialog open={outOfCredits} onOpenChange={setOutOfCredits}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>You&apos;re out of credits</DialogTitle>
            <DialogDescription>Top up to keep forging — or invite a friend and get $5 of credits for free.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" asChild>
              <Link href="/settings/referrals">
                <GiftIcon /> Invite a friend (+$5)
              </Link>
            </Button>
            <Button variant="ember" asChild>
              <Link href="/settings/billing">Top up credits</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this project?</DialogTitle>
            <DialogDescription>The code, the conversation and the VM will be permanently deleted.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const res = await fetch(`/api/v1/projects/${props.project.id}`, { method: "DELETE" });
                if (res.ok) {
                  toast.success("Project deleted");
                  router.push("/dashboard");
                }
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
