"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownLeftIcon, ArrowUpRightIcon, CheckIcon, CoinsIcon, ExternalLinkIcon, GiftIcon, LoaderCircleIcon, SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCredits } from "@/lib/utils";
import { SettingsSection } from "./settings-nav";

type Tx = { id: string; type: string; amountMicros: number; balanceAfterMicros: number; description: string; createdAt: string };
type Plan = { id: string; name: string; priceUsd: number; monthlyCreditsUsd: number; tagline: string; features: string[]; highlighted?: boolean };

const TYPE_LABEL: Record<string, string> = {
  signup_bonus: "Welcome bonus",
  referral_bonus: "Referral reward",
  referee_bonus: "Referral gift",
  usage: "AI usage",
  purchase: "Top-up",
  subscription: "Plan credits",
  refund: "Refund",
  admin: "Adjustment",
};

async function redirectTo(endpoint: string, body?: unknown) {
  const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.url) throw new Error(data?.error?.message ?? "Could not open checkout");
  window.location.href = data.url;
}

export function BillingView({
  balance,
  plan,
  renewsAt,
  billingEnabled,
  transactions,
  plans,
  packs,
  usage30d,
}: {
  balance: number;
  plan: string;
  renewsAt: string | null;
  billingEnabled: boolean;
  transactions: Tx[];
  plans: Plan[];
  packs: number[];
  usage30d: number;
}) {
  const params = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const currentPlan = plans.find((p) => p.id === plan) ?? plans[0];

  useEffect(() => {
    if (params.get("success") === "credits") toast.success("Payment received. Your credits will appear in a few seconds.");
    if (params.get("success") === "plan") toast.success("Welcome to your new plan 🔥");
    const wanted = params.get("plan");
    if (wanted && wanted !== plan) document.getElementById(`plan-${wanted}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [params, plan]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border bg-card p-6 md:col-span-2">
          <div className="absolute -top-16 -right-16 size-56 rounded-full bg-[#ff7a1a]/20 blur-3xl" />
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CoinsIcon className="size-4 text-primary" /> Credit balance
          </p>
          <p className="mt-2 text-5xl font-semibold tracking-tight tabular-nums" data-testid="balance">
            {formatCredits(balance)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatCredits(usage30d, { precise: true })} spent on AI in the last 30 days · credits never expire
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">Current plan</p>
          <p className="mt-2 text-2xl font-semibold">{currentPlan.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {currentPlan.priceUsd ? `$${currentPlan.priceUsd}/month · $${currentPlan.monthlyCreditsUsd} credits` : "Pay-as-you-go"}
          </p>
          {renewsAt && <p className="mt-1 text-xs text-muted-foreground">Renews {new Date(renewsAt).toLocaleDateString()}</p>}
          {plan !== "free" && billingEnabled && (
            <Button variant="outline" size="sm" className="mt-4" disabled={busy === "portal"} onClick={() => run("portal", () => redirectTo("/api/billing/portal"))}>
              {busy === "portal" ? <LoaderCircleIcon className="animate-spin" /> : <ExternalLinkIcon />} Manage subscription
            </Button>
          )}
        </div>
      </div>

      {!billingEnabled && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          Payments are not configured on this server yet (set <code className="font-mono">STRIPE_SECRET_KEY</code>). You can still earn credits by inviting friends.
        </div>
      )}

      <SettingsSection title="Top up credits" description="One-off packs, usable with any model. Every agent step shows its exact cost in the chat.">
        <div className="grid gap-3 sm:grid-cols-4">
          {packs.map((amount) => (
            <button
              key={amount}
              disabled={!billingEnabled || busy !== null}
              onClick={() => run(`pack-${amount}`, () => redirectTo("/api/billing/checkout", { kind: "pack", amountUsd: amount }))}
              className={cn(
                "group relative rounded-xl border bg-background/40 p-4 text-left transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50",
                amount === 25 && "border-primary/40",
              )}
            >
              {amount === 25 && <Badge className="absolute -top-2 right-3">Popular</Badge>}
              <p className="text-2xl font-semibold">${amount}</p>
              <p className="mt-1 text-xs text-muted-foreground">≈ {Math.round((amount / 0.15) / 10) * 10}+ agent steps</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                {busy === `pack-${amount}` ? <LoaderCircleIcon className="size-3 animate-spin" /> : <SparklesIcon className="size-3" />} Buy
              </span>
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Plans" description="Monthly credits plus perks. Cancel any time.">
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.id}
              id={`plan-${p.id}`}
              className={cn("flex flex-col rounded-xl border p-5", p.id === plan && "border-primary/50 bg-primary/5", p.highlighted && p.id !== plan && "border-primary/25")}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold">{p.name}</p>
                {p.id === plan && <Badge>Current</Badge>}
              </div>
              <p className="mt-2 text-3xl font-semibold">
                ${p.priceUsd}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <ul className="mt-4 flex-1 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm text-muted-foreground">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" /> {f}
                  </li>
                ))}
              </ul>
              {p.id !== "free" && p.id !== plan && (
                <Button
                  variant={p.highlighted ? "ember" : "outline"}
                  className="mt-5"
                  disabled={!billingEnabled || busy !== null}
                  onClick={() => run(`plan-${p.id}`, () => redirectTo("/api/billing/checkout", { kind: "plan", plan: p.id }))}
                >
                  {busy === `plan-${p.id}` && <LoaderCircleIcon className="animate-spin" />} Upgrade to {p.name}
                </Button>
              )}
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="History" description="Every credit movement on your account.">
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full text-sm" data-testid="transactions">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-5 pb-2 font-medium">Date</th>
                  <th className="px-2 pb-2 font-medium">Type</th>
                  <th className="px-2 pb-2 font-medium">Description</th>
                  <th className="px-2 pb-2 text-right font-medium">Amount</th>
                  <th className="px-5 pb-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="px-5 py-2.5 whitespace-nowrap text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</td>
                    <td className="px-2 py-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {t.type === "referral_bonus" || t.type === "referee_bonus" ? (
                          <GiftIcon className="size-3.5 text-primary" />
                        ) : t.amountMicros >= 0 ? (
                          <ArrowDownLeftIcon className="size-3.5 text-emerald-500" />
                        ) : (
                          <ArrowUpRightIcon className="size-3.5 text-muted-foreground" />
                        )}
                        {TYPE_LABEL[t.type] ?? t.type}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-2 py-2.5 text-muted-foreground">{t.description}</td>
                    <td className={cn("px-2 py-2.5 text-right whitespace-nowrap tabular-nums", t.amountMicros >= 0 ? "text-emerald-500" : "")}>
                      {t.amountMicros >= 0 ? "+" : ""}
                      {formatCredits(t.amountMicros, { precise: true })}
                    </td>
                    <td className="px-5 py-2.5 text-right whitespace-nowrap text-muted-foreground tabular-nums">{formatCredits(t.balanceAfterMicros)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
