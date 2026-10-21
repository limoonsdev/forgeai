"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { CheckIcon, CircleIcon, FileCodeIcon, GlobeIcon, LoaderCircleIcon, MousePointer2Icon, TerminalIcon } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./reveal";

const PROMPT = "A one-page site for Grain & Ember, a coffee roaster in Lyon. Menu, opening hours and an order-ahead form.";

const STEPS = [
  { title: "You describe it", body: "Plain words, a link or a screenshot. The agent boots a fresh VM with a Next.js project while it reads your request." },
  { title: "It asks, then plans", body: "When something matters and you didn't say, it asks one short question. Then it writes a plan you can follow." },
  { title: "It writes the code", body: "Real files in a real project: pages, components, server actions, styles. The preview reloads as each file lands." },
  { title: "It checks its work", body: "It opens the page in a browser inside the VM, clicks through it and reads the console. You see the cursor move." },
];

const PLAN = ["Layout, fonts and colours", "Hero with opening hours", "Menu from a typed data file", "Order-ahead form + server action", "Test the form in the browser"];

const FILES: [string, number][] = [
  ["app/page.tsx", 64],
  ["components/menu.tsx", 48],
  ["components/order-form.tsx", 91],
  ["app/actions.ts", 27],
  ["app/globals.css", 35],
];

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

function lerpPath(points: [number, number][], t: number): [number, number] {
  const segs = points.length - 1;
  const x = clamp(t) * segs;
  const i = Math.min(segs - 1, Math.floor(x));
  const f = x - i;
  const ease = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
  return [points[i][0] + (points[i + 1][0] - points[i][0]) * ease, points[i][1] + (points[i + 1][1] - points[i][1]) * ease];
}

/* ── The site being built (rendered inside the fake preview) ── */
function MockSite({ blocks, typedName, pressed, ordered }: { blocks: number; typedName: string; pressed: boolean; ordered: boolean }) {
  const show = (i: number) => cn("transition-all duration-500", blocks > i ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0");
  return (
    <div className="relative h-full overflow-hidden bg-[#f4eee6] font-sans text-[#2b1d14]">
      <div className={cn("flex items-center justify-between border-b border-[#2b1d14]/10 px-4 py-2.5", show(0))}>
        <span className="text-[11px] font-bold tracking-[0.2em] uppercase">Grain &amp; Ember</span>
        <span className="flex gap-3 text-[9px] text-[#2b1d14]/60">
          <span>Menu</span>
          <span>Visit</span>
          <span className="rounded-full bg-[#2b1d14] px-2 py-0.5 text-[#f4eee6]">Order</span>
        </span>
      </div>
      <div className={cn("grid grid-cols-[1.3fr_1fr] gap-3 px-4 pt-4", show(1))}>
        <div>
          <p className="text-[8px] font-semibold tracking-[0.2em] text-[#b4532a] uppercase">Roasted in Lyon since 2019</p>
          <p className="mt-1 font-display text-[19px] leading-[1.02] font-bold">Small batches. Roasted on Tuesdays.</p>
          <p className="mt-1.5 text-[9px] text-[#2b1d14]/65">Open Tue–Sat · 8:00–17:00 · 12 rue Mercière</p>
        </div>
        <div className="rounded-lg bg-[radial-gradient(circle_at_30%_30%,#c7743d,#5a2d17_70%)] shadow-inner" />
      </div>
      <div className={cn("mt-4 grid grid-cols-3 gap-2 px-4", show(2))}>
        {[
          ["Espresso", "2.40"],
          ["Flat white", "3.80"],
          ["Ethiopia filter", "4.20"],
        ].map(([n, p]) => (
          <div key={n} className="rounded-md border border-[#2b1d14]/10 bg-white/60 p-2">
            <p className="text-[9px] font-semibold">{n}</p>
            <p className="text-[8px] text-[#2b1d14]/60">€{p}</p>
          </div>
        ))}
      </div>
      <div className={cn("mx-4 mt-4 rounded-lg border border-[#2b1d14]/10 bg-white/70 p-3", show(3))}>
        <p className="text-[10px] font-semibold">Order ahead</p>
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
          <div className="flex h-6 items-center rounded border border-[#2b1d14]/15 bg-white px-2 text-[9px]">
            {typedName || <span className="text-[#2b1d14]/35">Your name</span>}
            {typedName && !ordered && <span className="ml-px h-3 w-px animate-pulse bg-[#2b1d14]" />}
          </div>
          <div className={cn("flex h-6 items-center rounded bg-[#b4532a] px-3 text-[9px] font-semibold text-white transition-transform", pressed && "scale-95 brightness-90")}>Place order</div>
        </div>
      </div>
      <AnimatePresence>
        {ordered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-md bg-[#2b1d14] px-2.5 py-1.5 text-[9px] font-medium text-[#f4eee6] shadow-lg"
          >
            <CheckIcon className="size-3" /> Order received. Ready at 9:40.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── The Forged workspace mock ── */
function Workspace({ step, local }: { step: number; local: number }) {
  const typedPrompt = step === 0 ? PROMPT.slice(0, Math.round(PROMPT.length * clamp(local * 1.6))) : PROMPT;
  const vmReady = step > 0 || local > 0.75;
  const planDone = step < 1 ? 0 : step > 1 ? PLAN.length - 1 : Math.floor(clamp((local - 0.35) / 0.65) * (PLAN.length - 1));
  const filesShown = step < 2 ? 0 : step > 2 ? FILES.length : Math.ceil(clamp(local * 1.2) * FILES.length);
  const blocks = step < 2 ? 0 : step > 2 ? 4 : Math.floor(clamp(local * 1.25) * 4.99);
  // Step 4: cursor path over the preview (x in % of the pane, y in px from the top of the mock site).
  const t = step === 3 ? local : step > 3 ? 1 : 0;
  const [cx, cy] = lerpPath(
    [
      [86, 40],
      [42, 272],
      [42, 272],
      [84, 272],
    ],
    clamp(t * 1.25),
  );
  const typedName = t > 0.32 ? "Camille".slice(0, Math.round(clamp((t - 0.32) / 0.2) * 7)) : "";
  const pressed = t > 0.78 && t < 0.86;
  const ordered = t > 0.84;

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_40px_120px_-40px_rgb(0_0_0/0.8)]">
      <div className="flex items-center gap-2 border-b bg-surface px-3 py-2">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
        </span>
        <span className="ml-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <LogoMark className="size-3.5" /> grain-and-ember
        </span>
        <span className={cn("ml-auto flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px]", vmReady ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
          {vmReady ? <span className="size-1.5 rounded-full bg-current" /> : <LoaderCircleIcon className="size-3 animate-spin" />}
          {vmReady ? "VM running" : "booting VM"}
        </span>
      </div>
      <div className="grid h-[340px] grid-cols-1 sm:h-[400px] sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)]">
        {/* chat */}
        <div className="hidden min-h-0 flex-col gap-2.5 overflow-hidden border-r p-3 text-[11.5px] sm:flex">
          <div className="ml-auto max-w-[92%] rounded-xl rounded-br-sm bg-secondary px-3 py-2 leading-snug">
            {typedPrompt}
            {step === 0 && local < 0.62 && <span className="ml-px inline-block h-3 w-px animate-pulse bg-foreground align-middle" />}
          </div>
          <AnimatePresence>
            {step >= 1 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border bg-background/50 p-2.5">
                <p className="font-medium">Which feel fits Grain &amp; Ember?</p>
                <div className="mt-2 grid gap-1">
                  {["Warm and editorial", "Minimal, lots of white", "Bold and loud"].map((o, i) => (
                    <span key={o} className={cn("flex items-center gap-2 rounded-md border px-2 py-1", i === 0 && (step > 1 || local > 0.25) && "border-primary/50 bg-primary/10")}>
                      {i === 0 && (step > 1 || local > 0.25) ? <CheckIcon className="size-3 text-primary" /> : <CircleIcon className="size-3 text-muted-foreground/50" />}
                      {o}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {(step > 1 || (step === 1 && local > 0.35)) && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border bg-background/50 p-2.5">
                <p className="mb-1.5 font-mono text-[9.5px] tracking-wider text-muted-foreground uppercase">Plan</p>
                {PLAN.map((item, i) => (
                  <p key={item} className={cn("flex items-center gap-2 py-0.5", i > planDone && "text-muted-foreground")}>
                    {i < planDone || step === 3 ? (
                      <CheckIcon className="size-3 text-success" />
                    ) : i === planDone ? (
                      <LoaderCircleIcon className="size-3 animate-spin text-primary" />
                    ) : (
                      <CircleIcon className="size-3 opacity-40" />
                    )}
                    {item}
                  </p>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          {step === 3 && local > 0.9 && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="leading-snug text-muted-foreground">
              Tested the order form in the browser. No console errors.
            </motion.p>
          )}
        </div>
        {/* preview / files */}
        <div className="relative min-h-0">
          {step === 2 && local < 0.999 ? (
            <div className="grid h-full grid-rows-[auto_minmax(0,1fr)]">
              <div className="space-y-1 border-b p-3 font-mono text-[10.5px]">
                {FILES.slice(0, filesShown).map(([f, n], i) => (
                  <motion.p key={f} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
                    <FileCodeIcon className="size-3 text-primary" />
                    <span className="truncate">{f}</span>
                    <span className="ml-auto text-success">+{n}</span>
                    {i === filesShown - 1 && local < 0.8 && <LoaderCircleIcon className="size-3 animate-spin text-muted-foreground" />}
                  </motion.p>
                ))}
              </div>
              <MockSite blocks={blocks} typedName="" pressed={false} ordered={false} />
            </div>
          ) : step >= 2 ? (
            <MockSite blocks={4} typedName={typedName} pressed={pressed} ordered={ordered} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-surface p-6 text-center font-mono text-[10.5px] text-muted-foreground">
              <TerminalIcon className="size-5" />
              <div className="space-y-1 text-left">
                <p>$ npm run dev</p>
                <p className={cn(vmReady ? "text-foreground" : "opacity-40")}>▲ Next.js 16 ready on :3000</p>
                <p className={cn(step >= 1 ? "text-foreground" : "opacity-40")}>○ Compiling / …</p>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="pointer-events-none absolute inset-0">
              <MousePointer2Icon
                className="absolute size-4 fill-white text-black drop-shadow-[0_2px_4px_rgb(0_0_0/0.5)]"
                style={{ left: `${cx}%`, top: cy, transform: pressed ? "scale(0.85)" : undefined }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function BuildStory() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [p, setP] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const q = Math.round(v * 400) / 400;
    setP((prev) => (prev === q ? prev : q));
  });

  if (reduced) {
    return (
      <section id="how" className="px-5 py-28">
        <SectionHeading eyebrow="How it works" title="One prompt, four steps you can watch." />
        <ol className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl border bg-card/60 p-5">
              <p className="font-mono text-xs text-primary">0{i + 1}</p>
              <p className="mt-2 font-semibold">{s.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="mx-auto mt-10 max-w-4xl">
          <Workspace step={4} local={1} />
        </div>
      </section>
    );
  }

  const step = Math.min(3, Math.floor(p * 4 * 0.999));
  const local = clamp(p * 4 - step);

  return (
    <section id="how" ref={ref} className="relative h-[420vh]">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden px-4 sm:px-6">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.35fr)] lg:gap-14">
          <div>
            <p className="font-mono text-xs font-medium tracking-[0.18em] text-primary uppercase">How it works</p>
            <h2 className="mt-3 font-display text-3xl leading-[1.05] font-bold sm:text-[2.6rem]">One prompt, four steps you can watch.</h2>
            <ol className="mt-6 hidden space-y-1 lg:block">
              {STEPS.map((s, i) => (
                <li key={s.title} className={cn("relative rounded-xl border border-transparent p-4 transition-colors duration-300", i === step && "border-border bg-card/70")}>
                  <div className="flex items-baseline gap-3">
                    <span className={cn("font-mono text-xs transition-colors", i <= step ? "text-primary" : "text-muted-foreground")}>0{i + 1}</span>
                    <div>
                      <p className={cn("font-semibold transition-colors", i === step ? "text-foreground" : "text-muted-foreground")}>{s.title}</p>
                      <div className={cn("grid transition-[grid-template-rows] duration-300", i === step ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                        <p className="overflow-hidden text-sm leading-relaxed text-muted-foreground">
                          <span className="block pt-1">{s.body}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                  {i === step && <span className="absolute bottom-0 left-4 h-px bg-primary" style={{ width: `calc((100% - 2rem) * ${local})` }} />}
                </li>
              ))}
            </ol>
            <div className="mt-4 lg:hidden">
              <p className="font-semibold">
                <span className="mr-2 font-mono text-xs text-primary">0{step + 1}</span>
                {STEPS[step].title}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{STEPS[step].body}</p>
            </div>
          </div>
          <div className="relative">
            <div aria-hidden className="absolute -inset-10 -z-10 rounded-[3rem] bg-[radial-gradient(50%_50%_at_50%_60%,color-mix(in_oklch,var(--brand)_18%,transparent),transparent_70%)]" />
            <Workspace step={step} local={local} />
            {step === 3 && local > 0.9 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute -bottom-12 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-card px-3 py-1.5 font-mono text-xs whitespace-nowrap shadow-lg"
              >
                <GlobeIcon className="size-3.5 text-success" /> camille-grain-and-ember.forged.dev
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
