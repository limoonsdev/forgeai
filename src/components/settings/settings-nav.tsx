"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCardIcon, GiftIcon, KeyRoundIcon, PuzzleIcon, SlidersHorizontalIcon, UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/settings/preferences", label: "Preferences", icon: SlidersHorizontalIcon },
  { href: "/settings/billing", label: "Credits & billing", icon: CreditCardIcon },
  { href: "/settings/referrals", label: "Referrals", icon: GiftIcon },
  { href: "/settings/skills", label: "Skills", icon: PuzzleIcon },
  { href: "/settings/api-keys", label: "API keys", icon: KeyRoundIcon },
  { href: "/settings/account", label: "Account", icon: UserIcon },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto pb-2 md:flex-col md:pb-0">
      {ITEMS.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={cn(
            "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground",
            pathname === i.href && "bg-accent text-foreground",
          )}
        >
          <i.icon className="size-4" />
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function SettingsSection({ title, description, children, action }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card/60">
      <div className="flex items-start justify-between gap-4 border-b p-5">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-md">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
