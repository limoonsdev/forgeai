"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { ArrowDownIcon } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { PromptComposer, type ComposerHandle } from "@/components/shared/prompt-composer";
import { EmberField } from "./ember-field";
import { EASE } from "./reveal";
import { useTypewriter } from "./typewriter";

const EXAMPLES = [
  "A landing page for a coffee roaster in Lyon, with an online order form",
  "A habit tracker with streaks, reminders and a yearly heatmap",
  "A client portal where freelancers share invoices and files",
  "A portfolio for a 3D artist with a filterable gallery",
  "Snake, playable in the browser, with a high-score table",
];

const CHIPS = [
  ["Coffee shop site", "A one-page site for a specialty coffee shop: menu, opening hours, map and an order-ahead form."],
  ["Habit tracker", "A habit tracker with daily check-ins, streaks and a yearly heatmap. Data saved in the browser."],
  ["Client portal", "A client portal where a freelancer shares invoices and files, with a login screen and a dashboard."],
  ["Portfolio", "A portfolio for a photographer with a masonry gallery, an about page and a contact form."],
  ["Browser game", "Snake in the browser with keyboard and touch controls, increasing speed and a local high-score table."],
] as const;

/** The 4-point spark from the logo, used as the headline's full stop. */
function Spark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 128" className={className} aria-hidden>
      <defs>
        <linearGradient id="hero-spark" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="var(--brand-glow)" />
          <stop offset="50%" stopColor="var(--brand)" />
          <stop offset="100%" stopColor="var(--brand-hot)" />
        </linearGradient>
      </defs>
      <path d="M48 0 C 52 40, 62 54, 96 64 C 62 74, 52 88, 48 128 C 44 88, 34 74, 0 64 C 34 54, 44 40, 48 0 Z" fill="url(#hero-spark)" />
    </svg>
  );
}

export function Hero({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [value, setValue] = useState("");
  const [saver, setSaver] = useState(false);
  const composer = useRef<ComposerHandle>(null);
  const typed = useTypewriter(EXAMPLES, { enabled: !value && !reduced });

  const submit = () => {
    const text = value.trim();
    if (!text) {
      composer.current?.focus();
      return false;
    }
    try {
      localStorage.setItem("forged:pending-prompt", JSON.stringify({ prompt: text, tokenSaver: saver, at: Date.now() }));
    } catch {}
    const q = `?prompt=${encodeURIComponent(text.slice(0, 1500))}${saver ? "&saver=1" : ""}`;
    router.push(signedIn ? `/dashboard${q}` : `/signup${q}`);
  };

  const fade = (delay: number) =>
    reduced ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay, ease: EASE } };

  return (
    <section id="top" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden px-4 pt-24 pb-6 sm:px-6">
      {/* The forge: heat rising from below, sparks drifting up. */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-x-0 bottom-0 h-[75%] bg-[radial-gradient(55%_60%_at_50%_100%,color-mix(in_oklch,var(--brand)_42%,transparent),color-mix(in_oklch,var(--brand-hot)_14%,transparent)_45%,transparent_75%)]" />
        <div className="forge-shimmer absolute inset-x-0 bottom-0 h-[45%] bg-[radial-gradient(40%_50%_at_50%_100%,color-mix(in_oklch,var(--brand-glow)_30%,transparent),transparent_70%)]" />
        <div className="heat-line absolute inset-x-[8%] bottom-0 h-px opacity-80" />
        <div className="grain absolute inset-0 opacity-[0.07] mix-blend-overlay" />
        <EmberField density={0.55} className="absolute inset-0 h-full w-full" />
      </div>

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center text-center">
        <motion.h1 {...fade(0.05)} className="font-display text-[2.6rem] leading-[0.95] font-extrabold text-balance sm:text-7xl lg:text-[5.4rem]">
          Forge something <br className="hidden sm:block" />
          real
          <Spark className="ml-1 inline-block h-[0.62em] w-[0.47em] translate-y-[-0.02em] align-baseline drop-shadow-[0_0_18px_color-mix(in_oklch,var(--brand)_70%,transparent)]" />
        </motion.h1>

        <motion.p {...fade(0.18)} className="mt-5 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
          Describe the app you want. An agent writes it in Next.js, runs it in its own VM and shows you every step.
        </motion.p>

        <motion.div {...fade(0.3)} className="mt-8 w-full max-w-2xl text-left">
          <PromptComposer
            ref={composer}
            value={value}
            onChange={setValue}
            onSubmit={submit}
            tokenSaver={saver}
            onTokenSaverChange={setSaver}
            signedIn={signedIn}
            submitLabel="Build"
            className="bg-card/90 backdrop-blur-xl"
            inputClassName="min-h-[5.25rem] text-base"
            placeholder={
              <>
                {reduced ? EXAMPLES[0] : typed}
                {!reduced && <span className="ml-0.5 inline-block h-[1.1em] w-0.5 translate-y-[0.2em] animate-pulse bg-primary" />}
              </>
            }
            modelSlot={
              <span className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground">
                <BrandLogo id="claude" className="size-3.5" />
                <span className="hidden sm:inline">Sonnet 5.5</span>
              </span>
            }
          />
        </motion.div>

        <motion.div {...fade(0.42)} className="mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
          {CHIPS.map(([label, prompt]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setValue(prompt);
                composer.current?.focus();
              }}
              className="rounded-full border bg-card/50 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur transition hover:border-primary/40 hover:text-foreground"
            >
              {label}
            </button>
          ))}
        </motion.div>
      </div>

      <motion.a
        href="#how"
        {...(reduced ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: 1, duration: 0.8 } })}
        className="mx-auto mt-6 flex flex-col items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
      >
        See a build, start to finish
        <ArrowDownIcon className="size-4 animate-bounce [animation-duration:2s]" />
      </motion.a>
    </section>
  );
}
