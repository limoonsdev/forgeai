import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const COLS: { title: string; links: [string, string][] }[] = [
  { title: "Product", links: [["How it works", "/#how"], ["Capabilities", "/#capabilities"], ["Models", "/#models"], ["Pricing", "/pricing"]] },
  { title: "Account", links: [["Log in", "/login"], ["Sign up", "/signup"], ["Dashboard", "/dashboard"], ["Invite friends", "/settings/referrals"]] },
  {
    title: "Legal",
    links: [
      ["Terms", "/legal/terms"],
      ["Privacy", "/legal/privacy"],
      ["Acceptable use", "/legal/acceptable-use"],
      ["Cookies", "/legal/cookies"],
      ["Legal notice", "/legal/legal-notice"],
      ["Security", "/legal/security"],
      ["Report content", "/report"],
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t bg-surface/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">An AI agent that builds Next.js web apps in its own VM, from a description.</p>
        </div>
        {COLS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="mb-3 text-sm font-medium">{c.title}</p>
            <ul className="space-y-2">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-muted-foreground transition hover:text-foreground">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Forged.dev</span>
          <span>Web apps only: Next.js, React, TypeScript, Tailwind.</span>
        </div>
      </div>
    </footer>
  );
}
