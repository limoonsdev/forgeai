import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { EmberField } from "@/components/landing/ember-field";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" className="w-fit">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <div className="mt-2 text-sm text-muted-foreground">{subtitle}</div>
          <div className="mt-8">{children}</div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to forge responsibly. Next.js apps only 🔥
        </p>
      </div>
      <div className="relative hidden overflow-hidden border-l bg-surface lg:block">
        <div className="bg-grid mask-radial absolute inset-0 opacity-60" />
        <div className="absolute bottom-[-20%] left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-[100%] bg-[radial-gradient(closest-side,rgba(255,106,26,0.4),transparent)] blur-2xl" />
        <EmberField className="absolute inset-0 h-full w-full" density={0.6} />
        <div className="relative flex h-full flex-col items-center justify-center px-12 text-center">
          <LogoMark glow className="size-24 drop-shadow-[0_20px_60px_rgba(255,106,26,0.55)]" />
          <h2 className="mt-8 max-w-md text-3xl font-semibold tracking-tight">
            Your next app is <span className="font-serif font-normal italic text-gradient-ember">one prompt</span> away.
          </h2>
          <ul className="mt-8 space-y-3 text-left text-sm text-muted-foreground">
            {[
              "A real agent writing real Next.js code",
              "Live preview in your own cloud VM",
              "Claude, GPT, Gemini, Grok — your choice",
              "$5 credits for every friend you invite",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary/15">
                  <CheckIcon className="size-3 text-primary" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
