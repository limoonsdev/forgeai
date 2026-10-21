"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { LoaderCircleIcon, PencilIcon, PlayIcon } from "lucide-react";
import { TEMPLATES, type Template, type TemplateLayout } from "@/lib/templates";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createProjectRequest } from "./new-project";

/** A tiny wireframe in the template's palette, drawn with CSS only. */
function Thumb({ layout, colors: [bg, accent, soft] }: { layout: TemplateLayout; colors: Template["colors"] }) {
  const bar = (w: string, c = soft, h = "h-1.5") => <div className={cn("rounded-full", h)} style={{ width: w, background: c, opacity: 0.9 }} />;
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-lg border" style={{ background: bg }}>
      <div className="flex items-center gap-1 px-2.5 py-2">
        <span className="size-1.5 rounded-full" style={{ background: accent }} />
        {bar("18%", soft, "h-1")}
        <span className="ml-auto flex gap-1">{bar("10px", soft, "h-1")}{bar("10px", soft, "h-1")}</span>
      </div>
      {layout === "dashboard" ? (
        <div className="flex h-full gap-2 px-2.5">
          <div className="w-1/5 space-y-1.5 pt-1">{[60, 80, 70, 50].map((w) => <div key={w}>{bar(`${w}%`, soft, "h-1")}</div>)}</div>
          <div className="flex-1 space-y-2">
            <div className="grid grid-cols-4 gap-1">{[0, 1, 2, 3].map((i) => <div key={i} className="h-5 rounded" style={{ background: soft, opacity: 0.25 }} />)}</div>
            <div className="h-10 rounded" style={{ background: `linear-gradient(180deg, ${accent}55, transparent)` }} />
          </div>
        </div>
      ) : layout === "store" ? (
        <div className="grid grid-cols-4 gap-1.5 px-2.5 pt-1">{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className="aspect-square rounded" style={{ background: i % 3 === 0 ? accent : soft, opacity: i % 3 === 0 ? 0.85 : 0.3 }} />)}</div>
      ) : layout === "game" ? (
        <div className="relative mx-auto mt-1 h-3/5 w-3/5 rounded border" style={{ borderColor: `${accent}66` }}>
          <div className="absolute top-1/3 left-1/4 h-1.5 w-8 rounded-sm" style={{ background: accent }} />
          <div className="absolute right-1/4 bottom-1/4 size-1.5 rounded-full" style={{ background: "#f43f5e" }} />
        </div>
      ) : layout === "docs" ? (
        <div className="flex gap-2 px-2.5 pt-1">
          <div className="w-1/4 space-y-1.5">{[70, 50, 80, 60, 40].map((w, i) => <div key={i}>{bar(`${w}%`, i === 1 ? accent : soft, "h-1")}</div>)}</div>
          <div className="flex-1 space-y-1.5">{bar("50%", soft, "h-2")}{bar("90%", soft, "h-1")}{bar("80%", soft, "h-1")}<div className="h-6 rounded" style={{ background: soft, opacity: 0.15 }} /></div>
        </div>
      ) : layout === "app" ? (
        <div className="grid grid-cols-3 gap-1.5 px-2.5 pt-1">{[0, 1, 2].map((c) => <div key={c} className="space-y-1 rounded p-1" style={{ background: `${soft}22` }}>{[0, 1, 2].slice(0, 3 - (c % 2)).map((i) => <div key={i} className="h-3 rounded-sm" style={{ background: i === 0 && c === 1 ? accent : soft, opacity: i === 0 && c === 1 ? 0.9 : 0.35 }} />)}</div>)}</div>
      ) : (
        <div className="space-y-1.5 px-2.5 pt-2">
          {layout === "portfolio" ? null : bar("30%", accent, "h-1")}
          {bar("70%", soft, "h-2.5")}
          {bar("45%", soft, "h-2.5")}
          <div className="flex gap-1 pt-1">{bar("16%", accent, "h-2")}{bar("12%", soft, "h-2")}</div>
          {layout !== "landing" && <div className="grid grid-cols-3 gap-1 pt-1">{[0, 1, 2].map((i) => <div key={i} className="h-6 rounded" style={{ background: soft, opacity: 0.25 }} />)}</div>}
        </div>
      )}
    </div>
  );
}

export function TemplatesGallery() {
  const router = useRouter();
  const [category, setCategory] = useState<string>("All");
  const [editing, setEditing] = useState<Template | null>(null);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const categories = ["All", ...new Set(TEMPLATES.map((t) => t.category))];

  const start = async (t: Template, prompt = t.prompt) => {
    setBusy(t.id);
    try {
      const { project } = await createProjectRequest({ prompt, model: "", tokenSaver: false });
      router.push(`/project/${project.id}`);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(null);
    }
  };

  return (
    <>
      <div className="mt-8 flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={cn("rounded-full border px-3 py-1 text-xs transition", category === c ? "border-primary/50 bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {c}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.filter((t) => category === "All" || t.category === category).map((t) => (
          <div key={t.id} className="group flex flex-col rounded-2xl border bg-card/60 p-3 transition hover:border-foreground/20" data-testid={`template-${t.id}`}>
            <Thumb layout={t.layout} colors={t.colors} />
            <div className="flex flex-1 flex-col px-1 pt-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{t.name}</h3>
                <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">{t.category}</span>
              </div>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{t.summary}</p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="ember" onClick={() => start(t)} disabled={busy !== null}>
                  {busy === t.id ? <LoaderCircleIcon className="animate-spin" /> : <PlayIcon />} Use template
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setBrief(t.prompt);
                    setEditing(t);
                  }}
                >
                  <PencilIcon /> Edit brief
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing.name}</DialogTitle>
              <DialogDescription>Change names, colours or features before the agent starts.</DialogDescription>
            </DialogHeader>
            <Textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={12} maxLength={8000} />
            <DialogFooter>
              <Button variant="ember" onClick={() => start(editing, brief)} disabled={busy !== null || brief.trim().length < 10}>
                {busy === editing.id ? <LoaderCircleIcon className="animate-spin" /> : <PlayIcon />} Start building
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
