import type { Metadata } from "next";
import { PricingSection } from "@/components/landing/pricing";
import { Faq, FinalCta } from "@/components/landing/sections";
import { getSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "Pricing", description: "Forged plans and pay-as-you-go AI credits." };

export default async function PricingPage() {
  const session = await getSession().catch(() => null);
  return (
    <div className="pt-16">
      <PricingSection signedIn={Boolean(session)} heading="Simple plans, usage-based credits." />
      <Faq />
      <FinalCta />
    </div>
  );
}
