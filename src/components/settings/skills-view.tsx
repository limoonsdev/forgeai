"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EyeIcon, FileUpIcon, LinkIcon, LoaderCircleIcon, PlusIcon, PuzzleIcon, Trash2Icon, TypeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/shared/markdown";
import { SettingsSection } from "./settings-nav";

type Builtin = { slug: string; name: string; description: string; content: string; enabled: boolean };
type Custom = { id: string; slug: string; name: string; description: string; content: string; source: string; sourceUrl: string | null; enabled: boolean };

const EXAMPLE = `---
name: brand-guidelines
description: Our brand colors, typography and tone of voice. Use for any UI or copy work.
---

# Brand guidelines

- Primary color: #FF6A1A, background: #0F0B09
- Headings: Instrument Serif italic for accents, Geist for everything else
- Tone: confident, warm, never corporate`;

function Preview({ name, content }: { name: string; content: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={`Preview ${name}`}>
          <EyeIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono">{name}</DialogTitle>
        </DialogHeader>
        <Markdown>{content}</Markdown>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("paste");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async (body: Record<string, unknown>) => {
    setBusy(true);
    const res = await fetch("/api/settings/skills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return toast.error(data?.error?.message ?? "Import failed");
    toast.success(`Skill “${data.skill.name}” imported`);
    setOpen(false);
    setContent("");
    setUrl("");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ember" size="sm" data-testid="import-skill">
          <PlusIcon /> Import skill
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import a skill</DialogTitle>
          <DialogDescription>
            Skills are markdown files (SKILL.md) with a <code className="font-mono">name</code> and <code className="font-mono">description</code> in the front matter. The agent sees the description and loads the full skill when it&apos;s relevant.
          </DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="paste">
              <TypeIcon /> Paste
            </TabsTrigger>
            <TabsTrigger value="url">
              <LinkIcon /> From URL
            </TabsTrigger>
            <TabsTrigger value="upload">
              <FileUpIcon /> Upload
            </TabsTrigger>
          </TabsList>
          <TabsContent value="paste" className="space-y-3">
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12} className="font-mono text-xs" placeholder={EXAMPLE} data-testid="skill-content" />
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => setContent(EXAMPLE)}>
                Use example
              </Button>
              <Button variant="ember" disabled={!content.trim() || busy} onClick={() => submit({ source: "paste", content })} data-testid="skill-submit">
                {busy && <LoaderCircleIcon className="animate-spin" />} Import
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="url" className="space-y-3">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/org/repo/blob/main/skills/my-skill/SKILL.md" />
            <p className="text-xs text-muted-foreground">Supported: GitHub, GitLab, Gist, Hugging Face, Bitbucket.</p>
            <div className="flex justify-end">
              <Button variant="ember" disabled={!url.trim() || busy} onClick={() => submit({ source: "url", url })}>
                {busy && <LoaderCircleIcon className="animate-spin" />} Import
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="upload" className="space-y-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed py-12 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
            >
              <FileUpIcon className="mb-2 size-6" /> Choose a .md file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".md,.markdown,text/markdown,text/plain"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 100 * 1024) return toast.error("Skills are limited to 100 KB");
                await submit({ source: "upload", content: await file.text(), filename: file.name });
                e.target.value = "";
              }}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export function SkillsView({ builtin, custom }: { builtin: Builtin[]; custom: Custom[] }) {
  const router = useRouter();
  const [b, setB] = useState(builtin);
  const [c, setC] = useState(custom);

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Your skills"
        description="Teach the agent your design system, stack conventions or domain knowledge. Imported skills are available in every project."
        action={<ImportDialog />}
      >
        {c.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed py-10 text-center">
            <PuzzleIcon className="size-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">No custom skills yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Import a SKILL.md to give the agent new expertise.</p>
          </div>
        ) : (
          <ul className="divide-y" data-testid="custom-skills">
            {c.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-mono text-sm font-medium">
                    {s.slug} <Badge variant="outline">{s.source}</Badge>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{s.description}</p>
                </div>
                <Preview name={s.slug} content={s.content} />
                <Switch
                  checked={s.enabled}
                  onCheckedChange={async (enabled) => {
                    setC((all) => all.map((x) => (x.id === s.id ? { ...x, enabled } : x)));
                    await fetch(`/api/settings/skills/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
                  }}
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Delete skill"
                  onClick={async () => {
                    await fetch(`/api/settings/skills/${s.id}`, { method: "DELETE" });
                    setC((all) => all.filter((x) => x.id !== s.id));
                    toast.success("Skill deleted");
                    router.refresh();
                  }}
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>

      <SettingsSection title="Built-in skills" description="Curated by the Forged team for Next.js apps. Turn off anything you don't want the agent to use.">
        <ul className="divide-y">
          {b.map((s) => (
            <li key={s.slug} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-medium">{s.slug}</p>
                <p className="text-xs text-muted-foreground">{s.description}</p>
              </div>
              <Preview name={s.slug} content={s.content} />
              <Switch
                checked={s.enabled}
                onCheckedChange={async (enabled) => {
                  setB((all) => all.map((x) => (x.slug === s.slug ? { ...x, enabled } : x)));
                  await fetch("/api/settings/skills/builtin", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: s.slug, enabled }) });
                }}
              />
            </li>
          ))}
        </ul>
      </SettingsSection>
    </div>
  );
}
