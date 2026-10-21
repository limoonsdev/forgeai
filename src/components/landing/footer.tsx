import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const COLS = [
  { title: "Product", links: [["Features", "/#features"], ["Models", "/#models"], ["Pricing", "/pricing"], ["API", "/docs"]] },
  { title: "Account", links: [["Log in", "/login"], ["Sign up", "/signup"], ["Dashboard", "/dashboard"], ["Referrals", "/settings/referrals"]] },
  { title: "Resources", links: [["API reference", "/docs"], ["Skills", "/settings/skills"], ["Status", "/docs#status"]] },
];

export function Footer() {
  return (
    <footer className="border-t bg-surface/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">The AI agent that forges production-ready Next.js apps from a single prompt.</p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
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
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Forged.dev — Built with fire.</span>
          <span>Next.js apps only. No C++ was harmed in the making of this product.</span>
        </div>
      </div>
    </footer>
  );
}
