"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GiftIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { CreditsPill } from "@/components/shared/credits-pill";
import { UserMenu } from "@/components/shared/user-menu";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Projects" },
  { href: "/settings/skills", label: "Skills" },
  { href: "/settings/billing", label: "Credits" },
  { href: "/docs", label: "API" },
];

export function AppHeader({ user, credits }: { user: { name: string; email: string; image?: string | null; plan: string }; credits: number }) {
  const pathname = usePathname();
  return (
    <header className="glass sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/dashboard">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground",
                pathname.startsWith(n.href) && "bg-accent text-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/settings/referrals"
            className="hidden items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/15 sm:inline-flex"
          >
            <GiftIcon className="size-3.5" /> Get $5
          </Link>
          <CreditsPill micros={credits} />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
