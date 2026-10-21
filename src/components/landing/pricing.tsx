import Link from "next/link";
import { CheckIcon, GiftIcon } from "lucide-react";
import { PAYMENTS_ENABLED, PLANS } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Reveal, SectionHeading } from "./reveal";

export function PricingSection({ signedIn, heading = "Pay for what the agent uses." }: { signedIn: boolean; heading?: string }) {
  return (
    <section id="pricing" className="px-4 py-28 sm:px-6">
      <SectionHeading
        eyebrow="Pricing"
        title={heading}
        description="Credits are charged from the tokens each step really used. Plans add monthly credits, more published apps and priority when the servers are busy."
      />
      {!PAYMENTS_ENABLED && (
        <Reveal className="mx-auto mt-8 max-w-xl rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-center text-sm">
          Paid plans open soon. Until then everyone is on Free, and referral credits work as usual.
        </Reveal>
      )}
      <div className="mx-auto mt-12 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan, i) => {
          const paid = plan.id !== "free";
          const soon = paid && !PAYMENTS_ENABLED;
          return (
            <Reveal key={plan.id} delay={i * 0.06}>
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-2xl border bg-card/60 p-6",
                  plan.highlighted && "border-primary/45 bg-card shadow-[0_30px_80px_-40px_color-mix(in_oklch,var(--brand)_60%,transparent)]",
                )}
              >
                {plan.highlighted && <span className="btn-molten absolute -top-3 left-6 rounded-full px-2.5 py-0.5 text-[11px] font-semibold">Most chosen</span>}
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold">{plan.name}</h3>
                  {soon && <span className="rounded-full border px-2 py-0.5 font-mono text-[10px] text-muted-foreground uppercase">Soon</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold">${plan.priceUsd}</span>
                  <span className="text-sm text-muted-foreground">/ month</span>
                </div>
                <ul className="mt-5 flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                {soon ? (
                  <Button variant="outline" size="lg" className="mt-7 w-full" disabled>
                    Coming soon
                  </Button>
                ) : (
                  <Button asChild variant={plan.highlighted ? "ember" : "outline"} size="lg" className="mt-7 w-full">
                    <Link href={signedIn ? (paid ? `/settings/billing?plan=${plan.id}` : "/dashboard") : "/signup"}>{paid ? `Choose ${plan.name}` : signedIn ? "Open dashboard" : "Start free"}</Link>
                  </Button>
                )}
              </div>
            </Reveal>
          );
        })}
      </div>
      <Reveal className="mx-auto mt-5 flex max-w-6xl items-start gap-4 rounded-2xl border bg-card/40 p-5">
        <GiftIcon className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="text-sm">
          <p className="font-medium">$5 for you and $5 for each friend you invite</p>
          <p className="mt-1 text-muted-foreground">They get $5 when they sign up and verify their email. You get $5 when they finish their first build.</p>
        </div>
      </Reveal>
    </section>
  );
}
