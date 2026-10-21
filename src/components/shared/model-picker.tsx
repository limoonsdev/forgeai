"use client";

import { CheckIcon, ChevronDownIcon, LockIcon, SparklesIcon } from "lucide-react";
import type { PublicModel } from "@/lib/ai/catalog";
import { vendorColor } from "@/lib/ai/models";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useState } from "react";

function Dots({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn("h-1 w-2 rounded-full", i <= value ? "bg-primary" : "bg-muted")} />
      ))}
    </span>
  );
}

export function ModelPicker({
  models,
  value,
  onChange,
  compact = false,
  side = "top",
}: {
  models: PublicModel[];
  value: string;
  onChange: (id: string) => void;
  compact?: boolean;
  side?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const current = models.find((m) => m.id === value) ?? models[0];
  const vendors = [...new Set(models.map((m) => m.vendor))];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex max-w-[220px] items-center gap-1.5 rounded-lg border bg-background/40 px-2.5 py-1.5 text-xs font-medium transition hover:bg-accent"
          data-testid="model-picker"
        >
          <SparklesIcon className="size-3.5 shrink-0 text-primary" />
          <span className="truncate">{current ? (compact ? current.label.replace(/^Claude /, "") : current.label) : "Select model"}</span>
          <ChevronDownIcon className="size-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} align="start" className="w-[380px] p-1.5">
        <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
          {vendors.map((v) => (
            <div key={v} className="mb-1">
              <div className="px-2 pt-2 pb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{v}</div>
              {models
                .filter((m) => m.vendor === v)
                .map((m) => {
                  const disabled = !m.available || m.locked;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onChange(m.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition",
                        disabled ? "cursor-not-allowed opacity-45" : "hover:bg-accent",
                        m.id === value && "bg-accent",
                      )}
                    >
                      <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: vendorColor(m.vendor) }} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          {m.label}
                          {m.tags.slice(0, 1).map((t) => (
                            <span key={t} className="rounded-full bg-primary/15 px-1.5 py-px text-[9px] font-semibold text-primary">
                              {t}
                            </span>
                          ))}
                          {m.locked && <LockIcon className="size-3 text-muted-foreground" />}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                          {!m.available ? "Not configured on this server" : m.locked ? `Requires the ${m.minPlan ? m.minPlan[0].toUpperCase() + m.minPlan.slice(1) : "Pro"} plan` : m.description}
                        </span>
                        <span className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">IQ <Dots value={m.intelligence} /></span>
                          <span className="flex items-center gap-1">Speed <Dots value={m.speed} /></span>
                          <span className="ml-auto font-mono">
                            ${m.pricing.input}/${m.pricing.output} /M
                          </span>
                        </span>
                      </span>
                      {m.id === value && <CheckIcon className="mt-1 size-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
