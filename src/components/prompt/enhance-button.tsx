"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon, WandSparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const LEVELS = [
  { level: 1, label: "Tidy", hint: "Fixes wording and removes ambiguity. Same scope." },
  { level: 2, label: "Detailed", hint: "Adds pages, sections, features and example content." },
  { level: 3, label: "Full brief", hint: "Structure, design direction, data, interactions and a definition of done." },
] as const;

const LEVEL_KEY = "forged:enhance-level";

/** Magic wand: rewrites the prompt with the chosen amount of detail. Undo is one click away. */
export function EnhanceButton({ value, onChange, signedIn = true, disabled }: { value: string; onChange: (v: string) => void; signedIn?: boolean; disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState<1 | 2 | 3>(() => {
    if (typeof window === "undefined") return 2;
    try {
      const v = Number(localStorage.getItem(LEVEL_KEY));
      return v === 1 || v === 2 || v === 3 ? v : 2;
    } catch {
      return 2;
    }
  });
  const empty = value.trim().length < 3;

  const run = async () => {
    if (!signedIn) {
      try {
        localStorage.setItem("forged:pending-prompt", JSON.stringify({ prompt: value, enhance: level, at: Date.now() }));
      } catch {}
      router.push(`/signup?prompt=${encodeURIComponent(value.slice(0, 1500))}`);
      return;
    }
    setBusy(true);
    try {
      localStorage.setItem(LEVEL_KEY, String(level));
    } catch {}
    const original = value;
    try {
      const res = await fetch("/api/enhance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: value, level }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? "Couldn't enhance the prompt.");
      onChange(data.prompt);
      setOpen(false);
      toast.success("Prompt enhanced", { action: { label: "Undo", onClick: () => onChange(original) }, duration: 8000 });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content={empty ? "Write a few words, then enhance them" : "Enhance prompt"}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Enhance prompt"
            data-testid="enhance-button"
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-40",
              open && "bg-accent text-foreground",
            )}
          >
            {busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : <WandSparklesIcon className="size-4" />}
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent side="top" align="start" className="w-80 p-3">
        <p className="text-sm font-medium">Enhance prompt</p>
        <p className="mt-0.5 text-xs text-muted-foreground">How much should be added?</p>
        <div role="radiogroup" aria-label="Enhancement level" className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {LEVELS.map((l) => (
            <button
              key={l.level}
              type="button"
              role="radio"
              aria-checked={level === l.level}
              onClick={() => setLevel(l.level)}
              className={cn("rounded-md px-2 py-1.5 text-xs font-medium transition", level === l.level ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-1" aria-hidden>
          {[1, 2, 3].map((i) => (
            <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i <= level ? "heat-line" : "bg-muted")} />
          ))}
        </div>
        <p className="mt-2 min-h-[2.5rem] text-xs leading-relaxed text-muted-foreground">{LEVELS[level - 1].hint}</p>
        <button
          type="button"
          onClick={run}
          disabled={busy || empty}
          className="btn-molten mt-1 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold disabled:opacity-50"
          data-testid="enhance-run"
        >
          {busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : <WandSparklesIcon className="size-4" />}
          {!signedIn ? "Sign up to enhance" : empty ? "Write something first" : "Enhance"}
        </button>
      </PopoverContent>
    </Popover>
  );
}
