import Link from "next/link";
import { ArrowRightIcon, ArrowUpIcon, GlobeIcon, KeyRoundIcon, LockIcon, ServerIcon, ShieldCheckIcon, UserCheckIcon } from "lucide-react";
import { MODELS, vendorLogo } from "@/lib/ai/models";
import { CONNECTORS } from "@/lib/connectors/catalog";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Reveal, SectionHeading } from "./reveal";

/* ── Models ── */

export function ModelsShowcase() {
  const models = MODELS.filter((m) => m.provider !== "mock");
  return (
    <section id="models" className="px-4 py-28 sm:px-6">
      <SectionHeading
        eyebrow="Models"
        title="Pick the model for each message."
        description="Claude for most builds, a cheaper model for small edits, something else when you want a second opinion. Prices are per million tokens and every step shows what it cost."
      />
      <div className="mx-auto mt-14 grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {models.map((m, i) => (
          <Reveal key={m.id} delay={(i % 3) * 0.05}>
            <div className="flex h-full items-start gap-3.5 rounded-xl border bg-card/60 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background/60">
                <BrandLogo id={vendorLogo(m.vendor)} title={m.vendor} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {m.label}
                  {m.minPlan && <span className="rounded bg-primary/15 px-1.5 py-px font-mono text-[9px] font-semibold text-primary uppercase">{m.minPlan}</span>}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{m.description}</p>
                <p className="mt-2 font-mono text-[10.5px] text-muted-foreground">
                  ${m.pricing.input} in · ${m.pricing.output} out
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ── Connectors ── */

export function ConnectorsStrip() {
  const items = CONNECTORS.filter((c) => !c.internal);
  const half = Math.ceil(items.length / 2);
  const rows = [items.slice(0, half), items.slice(half)];
  return (
    <section className="overflow-hidden py-24">
      <SectionHeading
        eyebrow="Connectors"
        title="Bring your own services."
        description="Add a key once in settings. The agent gets a short guide for each service and wires it into your app: databases, auth, payments, email, maps, media generation."
        className="px-4"
      />
      <div className="mask-fade-x mt-12 space-y-3">
        {rows.map((row, r) => (
          <div key={r} className="flex w-max gap-3" style={{ animation: `marquee-scroll ${60 + r * 12}s linear infinite ${r ? "reverse" : ""}` }}>
            {[...row, ...row].map((c, i) => (
              <span key={`${c.id}-${i}`} aria-hidden={i >= row.length} className="flex items-center gap-2.5 rounded-xl border bg-card/60 px-4 py-2.5 text-sm whitespace-nowrap">
                <BrandLogo id={c.logo} title={c.name} className="size-4" />
                {c.name}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Publish ── */

export function PublishSection() {
  return (
    <section className="px-4 py-28 sm:px-6">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <SectionHeading
          align="left"
          eyebrow="Publish"
          title="Live on your own address in one click."
          description="Publishing builds a production version of your app and serves it at your-name-project on our domain, with HTTPS. Republish whenever you like; the previous version stays up until the new one is ready."
        />
        <Reveal delay={0.1}>
          <div className="rounded-2xl border bg-card/70 p-5 shadow-[0_30px_80px_-40px_rgb(0_0_0/0.8)]">
            <div className="flex items-center gap-2 rounded-lg border bg-background/60 px-3 py-2 font-mono text-sm">
              <LockIcon className="size-3.5 text-success" />
              <span className="text-muted-foreground">https://</span>
              <span className="typing-url overflow-hidden whitespace-nowrap">camille-grain-and-ember</span>
              <span className="text-muted-foreground">.forged.dev</span>
            </div>
            <div className="mt-4 space-y-2 font-mono text-xs">
              {[
                ["Installing dependencies", "6.1s"],
                ["next build", "18.4s"],
                ["Starting production server", "1.2s"],
                ["Switching traffic", "0.1s"],
              ].map(([l, t]) => (
                <p key={l} className="flex items-center gap-2">
                  <span className="text-success">✓</span>
                  {l}
                  <span className="ml-auto text-muted-foreground">{t}</span>
                </p>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 border-t pt-4 text-sm">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              Live
              <GlobeIcon className="ml-auto size-4 text-muted-foreground" />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Security & privacy ── */

const SECURITY = [
  { icon: ServerIcon, title: "Isolated VMs", body: "Each project runs in its own container under gVisor, with no capabilities, no access to other projects and no route to our internal network." },
  { icon: KeyRoundIcon, title: "Encrypted secrets", body: "Connector keys are encrypted at rest (AES-256-GCM), only decrypted inside your VM, and masked if they ever show up in a tool's output." },
  { icon: LockIcon, title: "No public API", body: "There is no API to script against Forged. Every request needs a signed-in session from our own pages, with CSRF and rate limits on each route." },
  { icon: UserCheckIcon, title: "Your data, your call", body: "Export everything you have stored with us, or delete your account and its data, from your settings. GDPR rights apply to everyone." },
  { icon: ShieldCheckIcon, title: "Code stays editable only by the agent", body: "Your files can't be edited by hand in the browser. That closes the easiest way to smuggle code into a VM; download or push to GitHub to edit elsewhere." },
];

export function SecuritySection() {
  return (
    <section className="px-4 py-28 sm:px-6">
      <SectionHeading eyebrow="Security and privacy" title="Built so your project stays yours." />
      <div className="mx-auto mt-14 grid max-w-6xl gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {SECURITY.map((s, i) => (
          <Reveal key={s.title} delay={(i % 3) * 0.05} className="bg-background p-6">
            <s.icon className="size-5 text-primary" />
            <p className="mt-4 font-semibold">{s.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </Reveal>
        ))}
        <Reveal delay={0.1} className="flex flex-col justify-between bg-background p-6">
          <p className="text-sm leading-relaxed text-muted-foreground">Found a vulnerability? We answer every report.</p>
          <Link href="/legal/security" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            Security policy <ArrowRightIcon className="size-3.5" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ── FAQ ── */

const FAQ: [string, string][] = [
  ["What can I build with Forged?", "Websites and web apps: landing pages, dashboards, internal tools, portfolios, stores, browser games. Everything is a Next.js project with React, TypeScript and Tailwind CSS. Forged doesn't build native mobile apps, desktop software or programs in other languages."],
  ["How do credits work?", "Each agent step is billed from the tokens the model actually used, plus a small margin. The chat shows the cost of every run and your balance updates live. New accounts get $1 after verifying their email."],
  ["Who owns the code?", "You do. Download the full source as a ZIP or push it to your GitHub account at any time and host it wherever you like."],
  ["Why can't I edit the code in the browser?", "Hand-edited files would run inside a VM on our servers without review, which is the simplest way to abuse a hosted sandbox. Ask the agent for changes, or export the project and edit it anywhere."],
  ["What happens when the server is busy?", "Previews start in a queue. You see your position and an estimated wait, and paid plans get priority. Your project and conversation are never lost while you wait."],
  ["Is there an API?", "No. Forged is only used through the website. This keeps the attack surface small and stops automated abuse."],
  ["How does the referral work?", "Share your link. Your friend gets $5 of credits when they sign up and verify their email, and you get $5 when they finish their first build."],
];

export function Faq() {
  return (
    <section id="faq" className="px-4 py-28 sm:px-6">
      <SectionHeading eyebrow="FAQ" title="Questions people ask first." />
      <div className="mx-auto mt-12 max-w-3xl divide-y rounded-2xl border bg-card/40">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {q}
              <span className="relative size-3 shrink-0" aria-hidden>
                <span className="absolute top-1/2 left-0 h-px w-3 bg-current" />
                <span className="absolute top-0 left-1/2 h-3 w-px bg-current transition-transform group-open:scale-y-0" />
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ── Final call to action ── */

export function FinalCta({ className }: { className?: string }) {
  return (
    <section className={cn("relative isolate overflow-hidden px-4 py-32 text-center sm:px-6", className)}>
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-full bg-[radial-gradient(50%_60%_at_50%_100%,color-mix(in_oklch,var(--brand)_30%,transparent),transparent_75%)]" />
      <div aria-hidden className="heat-line absolute inset-x-[10%] bottom-0 h-px" />
      <h2 className="mx-auto max-w-3xl font-display text-4xl leading-[1.02] font-extrabold text-balance sm:text-6xl">What will you build first?</h2>
      <p className="mx-auto mt-5 max-w-md text-muted-foreground">Free to start. $1 of credits when you verify your email, $5 more for each friend you invite.</p>
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <Button asChild variant="ember" size="xl">
          <a href="#top">
            Write a prompt <ArrowUpIcon />
          </a>
        </Button>
        <Button asChild variant="outline" size="xl">
          <Link href="/pricing">See pricing</Link>
        </Button>
      </div>
    </section>
  );
}
