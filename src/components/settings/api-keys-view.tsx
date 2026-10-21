"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { CheckIcon, CopyIcon, KeyRoundIcon, LoaderCircleIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { timeAgo } from "@/lib/utils";
import { SettingsSection } from "./settings-nav";

type Key = { id: string; name: string; prefix: string; lastUsedAt: string | null; createdAt: string };

export function ApiKeysView({ initial, baseUrl }: { initial: Key[]; baseUrl: string }) {
  const [keys, setKeys] = useState(initial);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const create = async () => {
    setBusy(true);
    const res = await fetch("/api/settings/api-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return toast.error(data?.error?.message ?? "Could not create the key");
    setCreated(data.key);
    setKeys((k) => [{ ...data.record, lastUsedAt: null }, ...k]);
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        title="API keys"
        description="Use the Forged REST API to create projects, prompt the agent, stream events, read files and drive the VM."
        action={
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) {
                setCreated(null);
                setName("");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="ember" size="sm" data-testid="new-api-key">
                <PlusIcon /> New key
              </Button>
            </DialogTrigger>
            <DialogContent>
              {created ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Your new API key</DialogTitle>
                    <DialogDescription>Copy it now — for your security it won&apos;t be shown again.</DialogDescription>
                  </DialogHeader>
                  <div className="flex gap-2">
                    <input readOnly value={created} className="h-10 min-w-0 flex-1 rounded-lg border bg-background/50 px-3 font-mono text-xs" data-testid="api-key-value" />
                    <Button
                      variant="ember"
                      onClick={async () => {
                        await navigator.clipboard.writeText(created).catch(() => {});
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                    >
                      {copied ? <CheckIcon /> : <CopyIcon />}
                    </Button>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => setOpen(false)}>Done</Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Create an API key</DialogTitle>
                    <DialogDescription>Keys act on your behalf and spend your credits. Keep them secret.</DialogDescription>
                  </DialogHeader>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CI pipeline" maxLength={60} autoFocus />
                  <DialogFooter>
                    <Button variant="ember" disabled={!name.trim() || busy} onClick={create}>
                      {busy && <LoaderCircleIcon className="animate-spin" />} Create key
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        }
      >
        {keys.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed py-10 text-center">
            <KeyRoundIcon className="size-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">No API keys</p>
            <p className="mt-1 text-xs text-muted-foreground">Create one to call the API from your code.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center gap-3 py-3">
                <KeyRoundIcon className="size-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{k.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {k.prefix}•••••••• · created {timeAgo(k.createdAt)} · {k.lastUsedAt ? `last used ${timeAgo(k.lastUsedAt)}` : "never used"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={async () => {
                    await fetch(`/api/settings/api-keys/${k.id}`, { method: "DELETE" });
                    setKeys((all) => all.filter((x) => x.id !== k.id));
                    toast.success("Key revoked");
                  }}
                >
                  <Trash2Icon /> Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>

      <SettingsSection title="Quick start" description="Forge an app from your terminal in one request.">
        <pre className="overflow-x-auto rounded-xl border bg-background/60 p-4 font-mono text-xs leading-relaxed">
          {`curl ${baseUrl}/api/v1/projects \\
  -H "Authorization: Bearer fg_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Habit tracker","prompt":"A habit tracker with streaks and a calendar heatmap"}'`}
        </pre>
        <p className="mt-3 text-sm text-muted-foreground">
          Full reference in the{" "}
          <Link href="/docs" className="text-primary hover:underline">
            API docs
          </Link>
          .
        </p>
      </SettingsSection>
    </div>
  );
}
