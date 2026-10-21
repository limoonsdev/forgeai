"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CodeIcon, GitForkIcon, LoaderCircleIcon, MessageSquareIcon, MonitorIcon } from "lucide-react";
import type { ChatMessageDTO, ToolResultPart } from "@/lib/ai/types";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ChatMessages } from "@/components/workspace/chat";
import { CodePanel } from "@/components/workspace/code-panel";
import { cn } from "@/lib/utils";

export function SharedSession({
  token,
  project,
  messages,
  files,
  signedIn,
}: {
  token: string;
  project: { name: string; description: string; allowRemix: boolean; previewUrl: string | null };
  messages: ChatMessageDTO[];
  files: string[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"chat" | "code" | "preview">("chat");
  const [selected, setSelected] = useState<string | null>(files.includes("app/page.tsx") ? "app/page.tsx" : files[0] ?? null);
  const [busy, setBusy] = useState(false);
  const results: Record<string, ToolResultPart> = {};
  for (const m of messages) if (m.content.kind === "tool") for (const r of m.content.results) results[r.toolCallId] = r;

  const remix = async () => {
    if (!signedIn) {
      router.push(`/signup?next=${encodeURIComponent(`/share/${token}`)}`);
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/share/${token}/remix`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return toast.error(data?.error?.message ?? "Could not remix");
    toast.success("Remixed! Opening your copy…");
    router.push(`/project/${data.project.id}`);
  };

  const tabs = [
    { id: "chat" as const, label: "Conversation", icon: MessageSquareIcon },
    { id: "code" as const, label: "Code", icon: CodeIcon },
    ...(project.previewUrl ? [{ id: "preview" as const, label: "Preview", icon: MonitorIcon }] : []),
  ];

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <Link href="/">
          <Logo />
        </Link>
        <span className="hidden text-muted-foreground sm:inline">/</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{project.name}</p>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">Shared build session · read-only</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {project.allowRemix && (
            <Button variant="outline" size="sm" onClick={remix} disabled={busy} data-testid="remix-button">
              {busy ? <LoaderCircleIcon className="animate-spin" /> : <GitForkIcon />} Remix
            </Button>
          )}
          <Button asChild variant="ember" size="sm">
            <Link href="/signup">Forge your own</Link>
          </Button>
        </div>
      </header>
      <div className="flex border-b px-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn("flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground", tab === t.id && "border-primary text-foreground")}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {tab === "chat" && (
          <div className="mx-auto flex h-full max-w-3xl flex-col">
            <ChatMessages messages={messages} streaming={null} results={results} pendingPollId={null} running={false} onAnswerPoll={() => {}} onOpenFile={(p) => {
              setSelected(p);
              setTab("code");
            }} />
          </div>
        )}
        {tab === "code" && <CodePanel projectId={token} filesBase={`/api/share/${token}/files`} files={files} selected={selected} onSelect={setSelected} changed={new Set()} externalVersion={0} readOnly />}
        {tab === "preview" && project.previewUrl && <iframe src={project.previewUrl} title="Preview" className="h-full w-full border-0 bg-white" sandbox="allow-scripts allow-same-origin allow-forms" />}
      </div>
    </div>
  );
}
