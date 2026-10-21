"use client";

import { AlertTriangleIcon, InfoIcon, WandSparklesIcon, XCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type AuditReportDTO = {
  path: string;
  scores: { performance: number; accessibility: number; seo: number; bestPractices: number };
  issues: { category: string; severity: "error" | "warn" | "info"; message: string }[];
  text: string;
};

function Ring({ value, label }: { value: number; label: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const color = value >= 90 ? "var(--success)" : value >= 50 ? "#f59e0b" : "var(--destructive)";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative size-16">
        <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted" />
          <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} className="transition-[stroke-dashoffset] duration-700" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-bold">{value}</span>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

const ICON = { error: XCircleIcon, warn: AlertTriangleIcon, info: InfoIcon } as const;

export function AuditSheet({ report, open, onOpenChange, onFix }: { report: AuditReportDTO | null; open: boolean; onOpenChange: (o: boolean) => void; onFix: (prompt: string) => void }) {
  if (!report) return null;
  const s = report.scores;
  const important = report.issues.filter((i) => i.severity !== "info");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Audit of {report.path}</DialogTitle>
          <DialogDescription>Measured in a real browser inside your VM (dev server, so performance is lower than in production).</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-2 py-2">
          <Ring value={s.performance} label="Performance" />
          <Ring value={s.accessibility} label="Accessibility" />
          <Ring value={s.seo} label="SEO" />
          <Ring value={s.bestPractices} label="Best practices" />
        </div>
        <div className="max-h-[42vh] space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
          {report.issues.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No issues found on this page.</p>}
          {report.issues.map((i, n) => {
            const Icon = ICON[i.severity];
            return (
              <div key={n} className="flex items-start gap-2.5 rounded-lg border bg-background/40 px-3 py-2 text-sm">
                <Icon className={cn("mt-0.5 size-4 shrink-0", i.severity === "error" ? "text-destructive" : i.severity === "warn" ? "text-amber-500" : "text-muted-foreground")} />
                <div className="min-w-0">
                  <span className="mr-2 rounded bg-muted px-1.5 py-px font-mono text-[10px] text-muted-foreground uppercase">{i.category}</span>
                  {i.message}
                </div>
              </div>
            );
          })}
        </div>
        {important.length > 0 && (
          <Button
            variant="ember"
            className="w-full"
            onClick={() => {
              onFix(`Fix the issues found by the audit of ${report.path}:\n${important.slice(0, 25).map((i) => `- [${i.category}] ${i.message}`).join("\n")}\nThen run audit_page again to confirm.`);
              onOpenChange(false);
            }}
          >
            <WandSparklesIcon /> Ask the agent to fix {important.length} issue{important.length > 1 ? "s" : ""}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
