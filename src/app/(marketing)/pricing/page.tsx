import type { Metadata } from "next";
import { PricingSection } from "@/components/landing/pricing";
import { Faq, FinalCta } from "@/components/landing/sections";
import { getSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "Pricing", description: "Simple plans and pay-as-you-go AI credits for Forged.dev." };

export default async function PricingPage() {
  const session = await getSession().catch(() => null);
  return (
    <div className="pt-16">
      <PricingSection signedIn={Boolean(session)} compactHeading />
      <Faq />
      <FinalCta />
    </div>
  );
}
