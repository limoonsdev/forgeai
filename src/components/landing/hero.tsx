"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowUpIcon, ChevronRightIcon, LeafIcon, PaperclipIcon, SparklesIcon } from "lucide-react";
import { EmberField } from "./ember-field";
import { useTypewriter } from "./typewriter";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "A SaaS landing page for an AI note-taking app with pricing and testimonials…",
  "A crypto portfolio dashboard with live charts and dark mode…",
  "A booking site for a Paris yoga studio with a class calendar…",
  "A Notion-style kanban board with drag & drop and local storage…",
  "A portfolio for a 3D artist with a masonry gallery and smooth animations…",
];

const CHIPS = ["SaaS landing page", "Analytics dashboard", "AI chat app", "E-commerce store", "Portfolio", "Browser game"];

const ease = [0.22, 1, 0.36, 1] as const;

function Headline() {
  const line1 = ["Forge", "real", "apps"];
  const line2 = ["from", "a", "single"];
  const word = (w: string, i: number) => (
    <motion.span
      key={`${w}-${i}`}
      className="text-gradient-fade inline-block"
      initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.8, delay: 0.15 + i * 0.07, ease }}
    >
      {w}&nbsp;
    </motion.span>
  );
  return (
    <h1 className="text-[2.75rem] leading-[0.98] font-semibold tracking-[-0.045em] sm:text-7xl lg:text-[5.6rem]">
      <span className="block">{line1.map((w, i) => word(w, i))}</span>
      <span className="block">
        {line2.map((w, i) => word(w, i + 3))}
        <motion.span
          className="inline-block pr-2 font-serif font-normal italic tracking-[-0.02em]"
          initial={{ opacity: 0, y: 24, filter: "blur(10px)", scale: 0.96 }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }}
          transition={{ duration: 1, delay: 0.62, ease }}
        >
          <span className="text-gradient-ember">prompt.</span>
        </motion.span>
      </span>
    </h1>
  );
}

export function Hero({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [saver, setSaver] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const placeholder = useTypewriter(EXAMPLES, { enabled: !value });

  const submit = (prompt = value) => {
    const text = prompt.trim();
    if (!text) {
      ref.current?.focus();
      return;
    }
    try {
      localStorage.setItem("forged:pending-prompt", JSON.stringify({ prompt: text, tokenSaver: saver, at: Date.now() }));
    } catch {}
    const q = `?prompt=${encodeURIComponent(text.slice(0, 1500))}${saver ? "&saver=1" : ""}`;
    router.push(signedIn ? `/dashboard${q}` : `/signup${q}`);
  };

  return (
    <section className="relative isolate overflow-hidden pt-32 pb-10 sm:pt-40">
      {/* Atmosphere */}
      <div className="bg-grid mask-radial absolute inset-0 -z-10 opacity-60" />
      <div className="absolute inset-x-0 top-0 -z-10 h-[680px] bg-[radial-gradient(ellipse_70%_55%_at_50%_-10%,rgba(255,122,26,0.22),transparent_70%)]" />
      <div className="animate-glow absolute bottom-[-30%] left-1/2 -z-10 h-[620px] w-[1100px] -translate-x-1/2 rounded-[100%] bg-[radial-gradient(closest-side,rgba(255,106,26,0.35),rgba(255,61,36,0.12)_55%,transparent)] blur-2xl" />
      <EmberField density={0.7} className="pointer-events-none absolute inset-0 -z-10 h-full w-full" />

      <div className="mx-auto flex max-w-5xl flex-col items-center px-5 text-center">
        <motion.a
          href="#models"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="group mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 py-1 pr-3 pl-1 text-xs text-muted-foreground backdrop-blur transition hover:border-primary/40 hover:text-foreground"
        >
          <span className="rounded-full bg-ember px-2 py-0.5 text-[0.68rem] font-semibold text-white">New</span>
          Claude Opus 5.5, GPT-5.6 &amp; Gemini 3.6 are live
          <ChevronRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </motion.a>

        <Headline />

        <motion.p
          className="mt-6 max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.75, ease }}
        >
          Describe it. Forged&apos;s AI agent writes, runs and previews a production-ready{" "}
          <span className="text-foreground">Next.js</span> app in its own cloud VM — then you ship it.
        </motion.p>

        {/* Prompt box */}
        <motion.div
          className="relative mt-10 w-full max-w-3xl"
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.9, ease }}
        >
          <div className={cn("absolute -inset-6 -z-10 rounded-[2rem] bg-[#ff7a1a]/20 blur-3xl transition-opacity duration-500", focused ? "opacity-100" : "opacity-40")} />
          <div className="relative overflow-hidden rounded-[1.4rem] p-px">
            <div className="animate-spin-slow absolute inset-[-120%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(255,122,26,0.9)_50deg,rgba(255,200,120,0.6)_80deg,transparent_140deg,transparent_360deg)]" />
            <div className="absolute inset-0 rounded-[1.4rem] bg-border" />
            <div className="relative rounded-[calc(1.4rem-1px)] bg-card/95 text-left backdrop-blur-xl">
              <div className="relative">
                <textarea
                  ref={ref}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  rows={3}
                  aria-label="Describe the app you want to build"
                  className="block min-h-[7.5rem] w-full resize-none bg-transparent px-5 pt-5 pb-2 text-[1.02rem] leading-relaxed outline-none"
                />
                {!value && (
                  <div className="pointer-events-none absolute inset-x-5 top-5 text-[1.02rem] leading-relaxed text-muted-foreground/80">
                    {placeholder}
                    <span className="ml-0.5 inline-block h-5 w-[2px] translate-y-1 animate-pulse bg-primary" />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 px-3 pb-3">
                <div className="flex items-center gap-1.5">
                  <button type="button" className="rounded-lg p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground" aria-label="Attach">
                    <PaperclipIcon className="size-4" />
                  </button>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border bg-background/40 px-2.5 py-1.5 text-xs font-medium">
                    <SparklesIcon className="size-3.5 text-primary" />
                    Claude Sonnet 5.5
                  </span>
                  <button
                    type="button"
                    onClick={() => setSaver((s) => !s)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                      saver ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "bg-background/40 text-muted-foreground hover:text-foreground",
                    )}
                    aria-pressed={saver}
                  >
                    <LeafIcon className="size-3.5" />
                    <span className="hidden sm:inline">Token saver</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => submit()}
                  className="group inline-flex h-10 items-center gap-2 rounded-xl bg-ember pr-3 pl-4 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(255,106,26,0.9)] transition hover:brightness-110"
                >
                  Forge it
                  <span className="flex size-6 items-center justify-center rounded-lg bg-white/20 transition group-hover:-translate-y-0.5">
                    <ArrowUpIcon className="size-3.5" />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="mt-5 flex max-w-3xl flex-wrap justify-center gap-2"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 1.1 } } }}
        >
          {CHIPS.map((c) => (
            <motion.button
              key={c}
              variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
              onClick={() => setValue(`Build a ${c.toLowerCase()} `)}
              className="rounded-full border bg-card/50 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur transition hover:border-primary/40 hover:text-foreground"
            >
              {c}
            </motion.button>
          ))}
        </motion.div>

        <motion.p
          className="mt-6 text-xs text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.8 }}
        >
          Free to start · $1 of credits on sign-up · <span className="text-foreground">+$5 for every friend you invite</span>
        </motion.p>
      </div>
    </section>
  );
}
