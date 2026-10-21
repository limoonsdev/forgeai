"use client";

import Link from "next/link";
import { CoinsIcon } from "lucide-react";
import { formatCredits, cn } from "@/lib/utils";

export function CreditsPill({ micros, className }: { micros: number; className?: string }) {
  const low = micros < 200_000;
  return (
    <Link
      href="/settings/billing"
      data-testid="credits-pill"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium tabular-nums transition hover:bg-accent",
        low && "border-amber-500/40 text-amber-500",
        className,
      )}
    >
      <CoinsIcon className="size-3.5 text-primary" />
      {formatCredits(micros)}
    </Link>
  );
}
