import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { BrandLogo } from "@/components/brand/brand-logo";
import { EmberField } from "@/components/landing/ember-field";

const POINTS = [
  ["Free to start", "$1 of credits once you confirm your email."],
  ["$5 per friend", "You and each friend you invite get $5."],
  ["Your code", "Download it or push it to GitHub whenever you want."],
] as const;

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-12">
        <Link href="/" className="w-fit" aria-label="Forged.dev home">
          <Logo />
        </Link>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="font-display text-3xl font-bold">{title}</h1>
          <div className="mt-2 text-sm text-muted-foreground">{subtitle}</div>
          <div className="mt-8">{children}</div>
        </main>
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/legal/terms" className="hover:text-foreground">
            Terms
          </Link>
          <span className="mx-2">·</span>
          <Link href="/legal/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <span className="mx-2">·</span>
          <Link href="/legal/cookies" className="hover:text-foreground">
            Cookies
          </Link>
        </p>
      </div>
      <aside className="relative hidden overflow-hidden border-l bg-iron lg:block">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-3/4 bg-[radial-gradient(60%_60%_at_50%_100%,color-mix(in_oklch,var(--brand)_35%,transparent),transparent_75%)]" />
        <div aria-hidden className="heat-line absolute inset-x-[10%] bottom-0 h-px" />
        <EmberField className="absolute inset-0 h-full w-full" density={0.5} />
        <div className="relative flex h-full flex-col justify-center px-14">
          <p className="font-mono text-xs tracking-[0.18em] text-primary uppercase">Forged.dev</p>
          <h2 className="mt-4 max-w-md font-display text-4xl leading-[1.05] font-bold text-balance">Describe it. Watch it get built.</h2>
          <dl className="mt-10 space-y-5">
            {POINTS.map(([t, d]) => (
              <div key={t} className="flex gap-4">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_12px_2px_color-mix(in_oklch,var(--brand)_70%,transparent)]" />
                <div>
                  <dt className="font-medium">{t}</dt>
                  <dd className="mt-0.5 text-sm text-muted-foreground">{d}</dd>
                </div>
              </div>
            ))}
          </dl>
          <div className="mt-12 flex items-center gap-3 text-muted-foreground">
            {["claude", "openai", "gemini", "grok", "deepseek", "qwen", "kimi"].map((id) => (
              <BrandLogo key={id} id={id} className="size-5 opacity-80" />
            ))}
            <span className="text-xs">and more</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
