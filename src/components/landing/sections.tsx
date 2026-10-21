"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import {
  ArrowRightIcon,
  BotIcon,
  CheckIcon,
  CopyIcon,
  CpuIcon,
  GiftIcon,
  GitForkIcon,
  KeyRoundIcon,
  LeafIcon,
  Link2Icon,
  MessageSquareIcon,
  PuzzleIcon,
  RocketIcon,
  ServerIcon,
  TerminalIcon,
  VoteIcon,
  WandSparklesIcon,
  XIcon,
} from "lucide-react";
import { Reveal, SectionHeading } from "./reveal";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ───────────── Stack marquee ───────────── */

const STACK = ["Next.js 16", "React 19", "TypeScript", "Tailwind CSS v4", "Server Components", "Route Handlers", "Motion", "Radix UI", "Supabase", "Stripe", "Vercel", "Drizzle", "Zod", "Recharts"];

export function StackMarquee() {
  return (
    <section className="relative border-y bg-surface/40 py-8">
      <p className="mb-6 text-center text-xs tracking-[0.2em] text-muted-foreground uppercase">Every app is forged on a production-grade stack</p>
      <div className="mask-fade-x relative flex overflow-hidden">
        <div className="animate-marquee flex shrink-0 gap-12 pr-12">
          {[...STACK, ...STACK].map((s, i) => (
            <span key={i} className="flex items-center gap-2 text-lg font-medium whitespace-nowrap text-muted-foreground/80">
              <span className="size-1.5 rounded-full bg-primary/60" />
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────── How it works ───────────── */

const STEPS = [
  {
    icon: MessageSquareIcon,
    title: "Describe",
    body: "Tell Forged what you want in plain words — or paste a screenshot of what you like. It asks smart questions when something matters.",
  },
  {
    icon: WandSparklesIcon,
    title: "Forge",
    body: "The agent plans, writes typed Next.js code, installs packages and checks its own work in a live VM — while you watch every step.",
  },
  {
    icon: RocketIcon,
    title: "Ship",
    body: "Iterate by chatting, edit the code yourself, share a live session, then export the repo or deploy anywhere Next.js runs.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative px-5 py-28">
      <SectionHeading eyebrow="How it works" title="From idea to app in" accent="three beats." description="No boilerplate, no setup, no localhost. Just the conversation and the result." />
      <div className="relative mx-auto mt-16 grid max-w-6xl gap-5 md:grid-cols-3">
        <div className="absolute top-12 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent md:block" />
        {STEPS.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.12}>
            <div className="group relative h-full rounded-2xl border bg-card/60 p-6 transition hover:border-primary/30">
              <div className="relative mb-5 flex size-12 items-center justify-center rounded-xl border bg-background">
                <s.icon className="size-5 text-primary" />
                <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-ember text-[10px] font-bold text-white">{i + 1}</span>
              </div>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ───────────── Features bento ───────────── */

function SpotlightCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const bg = useMotionTemplate`radial-gradient(420px circle at ${x}px ${y}px, rgba(255,122,26,0.12), transparent 70%)`;
  return (
    <div
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set(e.clientX - r.left);
        y.set(e.clientY - r.top);
      }}
      onMouseLeave={() => {
        x.set(-200);
        y.set(-200);
      }}
      className={cn("group relative overflow-hidden rounded-2xl border bg-card/60 p-6 transition-colors hover:border-primary/25", className)}
    >
      <motion.div className="pointer-events-none absolute inset-0" style={{ background: bg }} />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

function CardTitle({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
        <Icon className="size-4" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

const LOG = [
  ["update_plan", "4 tasks", "text-sky-400"],
  ["write_file", "app/page.tsx", "text-primary"],
  ["install_packages", "framer-motion", "text-violet-400"],
  ["write_file", "components/pricing.tsx", "text-primary"],
  ["check_preview", "/ → 200", "text-emerald-400"],
  ["edit_file", "app/layout.tsx", "text-amber-300"],
];

export function FeaturesBento() {
  return (
    <section id="features" className="relative px-5 py-28">
      <SectionHeading
        eyebrow="Features"
        title="A full-stack engineer,"
        accent="not a template engine."
        description="Forged is an autonomous agent with real tools, a real VM and real judgement — wrapped in the smoothest builder UX you've used."
      />
      <div className="mx-auto mt-16 grid max-w-6xl auto-rows-[minmax(250px,auto)] gap-4 md:grid-cols-6">
        <Reveal className="md:col-span-4">
          <SpotlightCard className="h-full">
            <div className="grid h-full gap-6 md:grid-cols-2">
              <CardTitle icon={BotIcon} title="A complete agent" body="Plans, writes, edits, installs, runs commands, reads logs and fixes its own errors until the preview is green." />
              <div className="rounded-xl border bg-background/60 p-3 font-mono text-[11.5px]">
                <div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
                  <TerminalIcon className="size-3.5" /> agent.log
                </div>
                {LOG.map(([tool, arg, color], i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.15 }}
                    className="flex gap-2 py-0.5"
                  >
                    <span className="text-muted-foreground">›</span>
                    <span className={color}>{tool}</span>
                    <span className="truncate text-muted-foreground">{arg}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </SpotlightCard>
        </Reveal>
        <Reveal className="md:col-span-2" delay={0.08}>
          <SpotlightCard className="h-full">
            <CardTitle icon={ServerIcon} title="A live VM per project" body="Every project boots its own sandbox running next dev. Hot reload, real npm, real errors." />
            <div className="mt-5 rounded-xl border bg-background/60 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-muted-foreground">vm-nebula-7f3a</span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> running
                </span>
              </div>
              <div className="mt-2 font-mono text-[11px] text-muted-foreground">▲ Next.js 16.4 · Ready in 1.2s</div>
            </div>
          </SpotlightCard>
        </Reveal>
        <Reveal className="md:col-span-2" delay={0.05}>
          <SpotlightCard className="h-full">
            <CardTitle icon={VoteIcon} title="It asks before it guesses" body="When a decision matters, the agent sends you a quick poll instead of guessing." />
            <div className="mt-5 rounded-xl border bg-background/60 p-3">
              <p className="text-xs font-medium">Which visual direction?</p>
              {["Bold & dark", "Clean & minimal", "Playful & colorful"].map((o, i) => (
                <div key={o} className={cn("mt-2 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs", i === 0 && "border-primary/50 bg-primary/10")}>
                  <span className={cn("size-3 rounded-full border", i === 0 && "border-primary bg-primary")} />
                  {o}
                </div>
              ))}
            </div>
          </SpotlightCard>
        </Reveal>
        <Reveal className="md:col-span-2" delay={0.1}>
          <SpotlightCard className="h-full">
            <CardTitle icon={LeafIcon} title="Token saver" body="One toggle: prompt caching, context trimming and leaner reasoning. Same app, a fraction of the cost." />
            <div className="mt-5 flex items-end gap-3">
              <div className="flex-1">
                <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>Standard</span>
                  <span>100%</span>
                </div>
                <div className="h-2 rounded-full bg-muted" />
                <div className="mt-3 mb-1 flex justify-between text-[11px] text-emerald-400">
                  <span>Token saver</span>
                  <span>≈ 45%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div className="h-full rounded-full bg-emerald-400" initial={{ width: 0 }} whileInView={{ width: "45%" }} viewport={{ once: true }} transition={{ duration: 1.2, delay: 0.3 }} />
                </div>
              </div>
            </div>
          </SpotlightCard>
        </Reveal>
        <Reveal className="md:col-span-2" delay={0.15}>
          <SpotlightCard className="h-full">
            <CardTitle icon={PuzzleIcon} title="Import skills" body="Drop in any SKILL.md — your design system, your stack conventions — and the agent loads it on demand." />
            <div className="mt-5 flex flex-wrap gap-2">
              {["ui-components", "supabase", "stripe-payments", "seo-metadata", "your-brand.md"].map((s, i) => (
                <span key={s} className={cn("rounded-lg border px-2 py-1 font-mono text-[11px]", i === 4 ? "border-dashed border-primary/50 text-primary" : "text-muted-foreground")}>
                  {s}
                </span>
              ))}
            </div>
          </SpotlightCard>
        </Reveal>
        <Reveal className="md:col-span-3" delay={0.05}>
          <SpotlightCard className="h-full">
            <CardTitle icon={GitForkIcon} title="Share & remix sessions" body="Send a link to the full build session — chat, code and live preview. Friends can remix it into their own project in one click." />
            <div className="mt-5 flex items-center gap-2 rounded-xl border bg-background/60 p-2 pl-3 text-xs">
              <Link2Icon className="size-3.5 text-muted-foreground" />
              <span className="truncate font-mono text-muted-foreground">forged.dev/share/k9Xf2…</span>
              <span className="ml-auto flex items-center gap-1 rounded-md bg-accent px-2 py-1">
                <CopyIcon className="size-3" /> Copy
              </span>
            </div>
          </SpotlightCard>
        </Reveal>
        <Reveal className="md:col-span-3" delay={0.1}>
          <SpotlightCard className="h-full">
            <CardTitle icon={KeyRoundIcon} title="A complete REST API" body="Create projects, prompt the agent, stream events, read files and drive the VM from your own code or CI." />
            <pre className="mt-5 overflow-x-auto rounded-xl border bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
              <span className="text-primary">curl</span> -X POST https://forged.dev/api/v1/projects \{"\n"}  -H <span className="text-emerald-400">&quot;Authorization: Bearer fg_live_…&quot;</span> \{"\n"}  -d <span className="text-amber-300">{`'{"prompt":"A habit tracker"}'`}</span>
            </pre>
          </SpotlightCard>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────── Models ───────────── */

const MODEL_CARDS = [
  { name: "Claude Sonnet 5.5", vendor: "Anthropic", color: "#d97757", speed: 4, iq: 4, tag: "Default" },
  { name: "Claude Opus 5.5", vendor: "Anthropic", color: "#d97757", speed: 3, iq: 5, tag: "Smartest" },
  { name: "Claude Fable 5.1", vendor: "Anthropic", color: "#d97757", speed: 2, iq: 5, tag: "Most capable" },
  { name: "GPT-5.6 Sol", vendor: "OpenAI", color: "#10a37f", speed: 3, iq: 5 },
  { name: "Gemini 3.6 Flash", vendor: "Google", color: "#4285f4", speed: 5, iq: 4, tag: "Fast" },
  { name: "Grok 4.6", vendor: "xAI", color: "#e5e5e5", speed: 3, iq: 4 },
  { name: "Claude Haiku 5.5", vendor: "Anthropic", color: "#d97757", speed: 5, iq: 3, tag: "Cheapest" },
  { name: "DeepSeek · Qwen · Kimi", vendor: "Open models", color: "#4d6bfe", speed: 3, iq: 3 },
];

function Bars({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="h-1.5 w-3 rounded-full" style={{ background: i <= value ? color : "var(--muted)" }} />
      ))}
    </div>
  );
}

export function ModelsShowcase() {
  return (
    <section id="models" className="relative px-5 py-28">
      <SectionHeading
        eyebrow="Model choice"
        title="Every frontier model."
        accent="One balance."
        description="Switch models mid-project, per message. Pay exactly what each call costs — no plan lock-in, no per-seat tax."
      />
      <div className="mx-auto mt-16 grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MODEL_CARDS.map((m, i) => (
          <Reveal key={m.name} delay={(i % 4) * 0.06}>
            <div className="group relative h-full overflow-hidden rounded-2xl border bg-card/60 p-5 transition hover:-translate-y-0.5 hover:border-primary/30">
              <div className="absolute -top-12 -right-12 size-32 rounded-full opacity-20 blur-2xl transition group-hover:opacity-40" style={{ background: m.color }} />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ background: m.color }} />
                  {m.vendor}
                </span>
                {m.tag && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">{m.tag}</span>}
              </div>
              <h3 className="mt-4 font-semibold">{m.name}</h3>
              <div className="mt-4 space-y-2 text-[11px] text-muted-foreground">
                <div className="flex items-center justify-between">
                  Intelligence <Bars value={m.iq} color={m.color} />
                </div>
                <div className="flex items-center justify-between">
                  Speed <Bars value={m.speed} color={m.color} />
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal className="mx-auto mt-8 flex max-w-6xl items-center justify-center gap-2 text-sm text-muted-foreground">
        <CpuIcon className="size-4 text-primary" />
        Prompt caching on every request · pay-as-you-go from $0.0001 per call
      </Reveal>
    </section>
  );
}

/* ───────────── Next.js only ───────────── */

const YES = ["SaaS products & landing pages", "Dashboards & internal tools", "E-commerce & marketplaces", "AI apps with streaming UIs", "Portfolios, blogs & docs", "Browser games with canvas"];
const NO = ["C / C++ / Rust binaries", "Python or Go scripts", "Native iOS / Android apps", "Unity & Unreal games", "Desktop software", "Plain HTML pages"];

export function NextOnly() {
  return (
    <section className="relative px-5 py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" /> Opinionated by design
          </div>
          <h2 className="text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">
            Next.js or nothing. <span className="font-serif font-normal italic text-gradient-ember">On purpose.</span>
          </h2>
          <p className="mt-5 text-muted-foreground sm:text-lg">
            Generalist AI builders spread themselves thin. Forged does one thing obsessively well: production-grade web apps on Next.js, React,
            TypeScript and Tailwind. Every prompt, every model and every skill is tuned for that stack — so what you get compiles, scales and
            ranks.
          </p>
          <Button asChild variant="ember" size="lg" className="mt-8">
            <Link href="/signup">
              Forge your first app <ArrowRightIcon />
            </Link>
          </Button>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border bg-card/60 p-5">
              <p className="mb-3 text-sm font-semibold text-emerald-400">Forged builds</p>
              {YES.map((y) => (
                <div key={y} className="flex items-center gap-2 py-1.5 text-sm">
                  <CheckIcon className="size-4 shrink-0 text-emerald-400" /> {y}
                </div>
              ))}
            </div>
            <div className="rounded-2xl border bg-card/30 p-5">
              <p className="mb-3 text-sm font-semibold text-muted-foreground">Not what we&apos;re for</p>
              {NO.map((n) => (
                <div key={n} className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground">
                  <XIcon className="size-4 shrink-0" /> {n}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────── Referral ───────────── */

export function ReferralBanner() {
  return (
    <section className="px-5 py-12">
      <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border bg-card/60 p-8 sm:p-12">
        <div className="absolute -top-24 -right-24 size-72 rounded-full bg-[#ff7a1a]/25 blur-3xl" />
        <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="flex items-start gap-5">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-ember shadow-[0_10px_30px_-10px_rgba(255,106,26,0.9)]">
              <GiftIcon className="size-7 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">Give $5, get $5.</h3>
              <p className="mt-2 max-w-xl text-muted-foreground">
                Share your referral link. Your friend starts with <span className="text-foreground">$5 of credits</span>, and you earn{" "}
                <span className="text-foreground">$5</span> as soon as they forge their first app. No limits.
              </p>
            </div>
          </div>
          <Button asChild variant="ember" size="lg">
            <Link href="/signup">Get my referral link</Link>
          </Button>
        </div>
      </Reveal>
    </section>
  );
}

/* ───────────── FAQ ───────────── */

const FAQ = [
  ["What exactly does Forged generate?", "A complete Next.js 16 project (App Router, React 19, TypeScript, Tailwind CSS v4) that runs live in a VM while you build. You own the code: export it as a zip at any time and deploy it anywhere Next.js runs."],
  ["How do credits work?", "Your balance is in dollars. Each agent step costs exactly what the model provider charges for the tokens used (plus a small platform margin), shown live in the chat. New accounts get $1, and every friend you invite adds $5."],
  ["Which models can I use?", "Claude Fable 5.1, Opus 5.5, Sonnet 5.5 and Haiku 5.5, GPT-5.6, Gemini, Grok, DeepSeek, Qwen and Kimi. Pick a default in your preferences and switch any time in the chat."],
  ["What does the token saver do?", "It enables aggressive prompt caching, clears stale tool results from the context, lowers reasoning effort and keeps replies short. Typical builds cost about half as much."],
  ["Why only Next.js? Can it build a C++ or Python app?", "No — and that's deliberate. Forged is specialised for modern web apps so every prompt, tool and skill is tuned for one stack. If you ask for something else, the agent will suggest a web-based alternative."],
  ["Can I use Forged programmatically?", "Yes. Create an API key in settings and use the REST API to create projects, prompt the agent (streaming or blocking), read and write files, run commands in the VM and export projects."],
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="px-5 py-28">
      <SectionHeading eyebrow="FAQ" title="Questions," accent="answered." />
      <div className="mx-auto mt-12 max-w-3xl divide-y rounded-2xl border bg-card/40">
        {FAQ.map(([q, a], i) => (
          <div key={q}>
            <button className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              {q}
              <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-transform", open === i && "rotate-45")}>+</span>
            </button>
            <motion.div initial={false} animate={{ height: open === i ? "auto" : 0, opacity: open === i ? 1 : 0 }} className="overflow-hidden">
              <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{a}</p>
            </motion.div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────── Final CTA ───────────── */

export function FinalCta() {
  return (
    <section className="relative overflow-hidden px-5 pt-20 pb-32">
      <div className="absolute bottom-0 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-[100%] bg-[radial-gradient(closest-side,rgba(255,106,26,0.35),transparent)] blur-2xl" />
      <Reveal className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
          <LogoMark glow className="size-28 drop-shadow-[0_20px_60px_rgba(255,106,26,0.55)]" />
        </motion.div>
        <h2 className="mt-8 text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
          The forge is <span className="font-serif font-normal italic text-gradient-ember">hot.</span>
        </h2>
        <p className="mt-5 max-w-xl text-muted-foreground sm:text-lg">Your next app is one prompt away. Start free — no credit card, $1 of credits on us.</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button asChild variant="ember" size="xl">
            <Link href="/signup">
              Start forging — it&apos;s free <ArrowRightIcon />
            </Link>
          </Button>
          <Button asChild variant="outline" size="xl">
            <Link href="/docs">Read the API docs</Link>
          </Button>
        </div>
      </Reveal>
    </section>
  );
}
