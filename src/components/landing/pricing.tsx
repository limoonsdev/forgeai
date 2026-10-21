import Link from "next/link";
import { CheckIcon, CoinsIcon, GiftIcon } from "lucide-react";
import { CREDIT_PACKS, PLANS } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Reveal, SectionHeading } from "./reveal";
import { cn } from "@/lib/utils";

export function PricingSection({ signedIn, compactHeading = false }: { signedIn: boolean; compactHeading?: boolean }) {
  return (
    <section id="pricing" className="relative px-5 py-28">
      <SectionHeading
        eyebrow="Pricing"
        title={compactHeading ? "Simple pricing," : "Pay for what you forge."}
        accent={compactHeading ? "real costs." : "Nothing else."}
        description="Plans add monthly credits and pro features. Credits are pay-as-you-go and never expire."
      />
      <div className="mx-auto mt-16 grid max-w-6xl gap-5 lg:grid-cols-3">
        {PLANS.map((plan, i) => (
          <Reveal key={plan.id} delay={i * 0.08}>
            <div
              className={cn(
                "relative flex h-full flex-col rounded-3xl border bg-card/60 p-7",
                plan.highlighted && "border-primary/40 bg-card shadow-[0_30px_80px_-30px_rgba(255,106,26,0.45)]",
              )}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-7 rounded-full bg-ember px-3 py-1 text-[11px] font-semibold text-white">Most popular</span>
              )}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-semibold tracking-tight">${plan.priceUsd}</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild variant={plan.highlighted ? "ember" : "outline"} size="lg" className="mt-8 w-full">
                <Link href={signedIn ? `/settings/billing${plan.id === "free" ? "" : `?plan=${plan.id}`}` : "/signup"}>
                  {plan.id === "free" ? "Start for free" : `Choose ${plan.name}`}
                </Link>
              </Button>
            </div>
          </Reveal>
        ))}
      </div>
      <div className="mx-auto mt-6 grid max-w-6xl gap-5 md:grid-cols-2">
        <Reveal>
          <div className="flex h-full items-start gap-4 rounded-3xl border bg-card/40 p-6">
            <CoinsIcon className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">Top up any time</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Credit packs of {CREDIT_PACKS.map((p) => `$${p}`).join(", ")} — on any plan. Every step shows its exact cost in the chat.
              </p>
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="flex h-full items-start gap-4 rounded-3xl border bg-card/40 p-6">
            <GiftIcon className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">$5 per friend you invite</p>
              <p className="mt-1 text-sm text-muted-foreground">Your friend gets $5 on sign-up, you get $5 when they forge their first app.</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
