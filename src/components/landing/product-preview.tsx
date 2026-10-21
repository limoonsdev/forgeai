"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "motion/react";
import {
  CheckIcon,
  CircleDashedIcon,
  FileCode2Icon,
  GlobeIcon,
  LoaderCircleIcon,
  MonitorIcon,
  PackageIcon,
  RotateCwIcon,
  SparklesIcon,
  CodeIcon,
} from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const STEPS = [
  { kind: "plan" },
  { kind: "tool", icon: FileCode2Icon, label: "Wrote app/page.tsx", meta: "+142" },
  { kind: "tool", icon: PackageIcon, label: "Installed recharts", meta: "npm" },
  { kind: "tool", icon: FileCode2Icon, label: "Wrote components/portfolio-chart.tsx", meta: "+88" },
  { kind: "tool", icon: FileCode2Icon, label: "Wrote components/holdings-table.tsx", meta: "+64" },
  { kind: "tool", icon: GlobeIcon, label: "Checked preview /", meta: "200 OK" },
  { kind: "done" },
] as const;

function MiniDashboard({ progress }: { progress: number }) {
  const show = (n: number) => progress >= n;
  return (
    <div className="flex h-full flex-col gap-3 bg-[#0b0d12] p-4 text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-5 rounded-md bg-gradient-to-br from-violet-500 to-cyan-400" />
          <span className="text-[11px] font-semibold">Nebula Portfolio</span>
        </div>
        <div className="flex gap-1.5">
          <span className="h-4 w-10 rounded bg-white/10" />
          <span className="h-4 w-4 rounded-full bg-white/20" />
        </div>
      </div>
      <AnimatePresence>
        {show(1) && (
          <motion.div className="grid grid-cols-3 gap-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {[
              ["Balance", "$48,210", "+4.2%"],
              ["24h P&L", "+$1,982", "+2.1%"],
              ["Assets", "12", "3 new"],
            ].map(([k, v, d]) => (
              <div key={k} className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
                <div className="text-[8px] text-white/50">{k}</div>
                <div className="text-[13px] font-semibold">{v}</div>
                <div className="text-[8px] text-emerald-400">{d}</div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative flex-1 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] p-2">
        <div className="text-[9px] text-white/50">Performance</div>
        {show(3) ? (
          <svg viewBox="0 0 300 100" className="mt-1 h-[calc(100%-14px)] w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="pp-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.path
              d="M0 80 C 30 70, 50 76, 75 60 S 120 40, 150 48 S 200 20, 230 28 S 270 10, 300 14 L 300 100 L 0 100 Z"
              fill="url(#pp-area)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
            />
            <motion.path
              d="M0 80 C 30 70, 50 76, 75 60 S 120 40, 150 48 S 200 20, 230 28 S 270 10, 300 14"
              fill="none"
              stroke="#a78bfa"
              strokeWidth="2"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </svg>
        ) : (
          <div className="mt-2 h-[calc(100%-18px)] animate-pulse rounded bg-white/5" />
        )}
      </div>
      <AnimatePresence>
        {show(4) && (
          <motion.div className="space-y-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {[
              ["BTC", "0.82", "#f7931a"],
              ["ETH", "6.10", "#627eea"],
              ["SOL", "84.3", "#14f195"],
            ].map(([s, a, c]) => (
              <div key={s} className="flex items-center justify-between rounded-md bg-white/[0.03] px-2 py-1 text-[9px]">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: c }} />
                  {s}
                </span>
                <span className="text-white/60">{a}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ProductPreview() {
  const section = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [24, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.4], [0.3, 1]);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s >= STEPS.length + 3 ? 0 : s + 1)), 1100);
    return () => clearInterval(id);
  }, []);

  const visible = STEPS.slice(0, Math.min(step, STEPS.length));
  const toolsDone = visible.filter((s) => s.kind === "tool").length;

  return (
    <section ref={section} className="relative px-4 pb-24 [perspective:1400px]">
      <motion.div
        style={{ rotateX, scale, opacity }}
        className="relative mx-auto max-w-6xl origin-top rounded-2xl border bg-card/80 shadow-[0_40px_120px_-30px_rgba(255,106,26,0.35)] backdrop-blur-xl"
      >
        <div className="absolute -inset-px -z-10 rounded-2xl bg-gradient-to-b from-primary/40 via-border to-transparent" />
        {/* window chrome */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <div className="flex gap-1.5">
            <span className="size-3 rounded-full bg-[#ff5f57]" />
            <span className="size-3 rounded-full bg-[#febc2e]" />
            <span className="size-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="mx-auto flex items-center gap-2 rounded-lg border bg-background/50 px-3 py-1 text-xs text-muted-foreground">
            <LogoMark className="size-3.5" /> forged.dev/project/nebula-portfolio
          </div>
          <div className="hidden w-14 sm:block" />
        </div>
        <div className="grid min-h-[460px] grid-cols-1 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
          {/* chat */}
          <div className="flex flex-col gap-3 border-r p-4 text-left">
            <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md bg-secondary px-3.5 py-2.5 text-[13px]">
              Build a crypto portfolio dashboard with live charts, dark mode and a holdings table.
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <LogoMark className="size-4" />
              <span className="font-medium text-foreground">Forged</span>
              <span className="rounded-md border px-1.5 py-0.5 text-[10px]">Claude Sonnet 5.5</span>
            </div>
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {visible.map((s, i) =>
                  s.kind === "plan" ? (
                    <motion.div key="plan" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border bg-background/40 p-3">
                      <div className="mb-2 text-[11px] font-medium text-muted-foreground">Plan</div>
                      {["Layout & KPI cards", "Performance chart", "Holdings table", "Verify preview"].map((t, j) => {
                        const done = toolsDone > j + 1 || step >= STEPS.length;
                        const active = !done && toolsDone >= j;
                        return (
                          <div key={t} className="flex items-center gap-2 py-0.5 text-[12px]">
                            {done ? (
                              <CheckIcon className="size-3.5 text-emerald-400" />
                            ) : active ? (
                              <LoaderCircleIcon className="size-3.5 animate-spin text-primary" />
                            ) : (
                              <CircleDashedIcon className="size-3.5 text-muted-foreground" />
                            )}
                            <span className={cn(done && "text-muted-foreground line-through")}>{t}</span>
                          </div>
                        );
                      })}
                    </motion.div>
                  ) : s.kind === "tool" ? (
                    <motion.div
                      key={`t${i}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 rounded-lg border bg-background/30 px-2.5 py-1.5 text-[12px]"
                    >
                      <s.icon className="size-3.5 text-primary" />
                      <span className="truncate">{s.label}</span>
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground">{s.meta}</span>
                    </motion.div>
                  ) : (
                    <motion.p key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[13px] leading-relaxed">
                      Done! 🔥 Your dashboard has KPI cards, an animated performance chart and a sortable holdings table. Want me to add
                      real-time prices next?
                    </motion.p>
                  ),
                )}
              </AnimatePresence>
              {step > 0 && step < STEPS.length && (
                <div className="shimmer-text flex items-center gap-1.5 text-[12px]">
                  <SparklesIcon className="size-3.5 text-primary" /> Forging…
                </div>
              )}
            </div>
            <div className="mt-auto rounded-xl border bg-background/40 px-3 py-2.5 text-[12px] text-muted-foreground">Ask Forged to change anything…</div>
          </div>
          {/* preview */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-foreground">
                <MonitorIcon className="size-3.5" /> Preview
              </span>
              <span className="flex items-center gap-1 px-2 py-1">
                <CodeIcon className="size-3.5" /> Code
              </span>
              <span className="ml-auto flex items-center gap-1.5">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> next dev · VM running
              </span>
              <RotateCwIcon className="size-3.5" />
            </div>
            <div className="relative flex-1 overflow-hidden rounded-br-2xl">
              <MiniDashboard progress={toolsDone} />
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
