import { Hero } from "@/components/landing/hero";
import { BuildStory } from "@/components/landing/build-story";
import { Capabilities } from "@/components/landing/capabilities";
import { PricingSection } from "@/components/landing/pricing";
import { ConnectorsStrip, Faq, FinalCta, ModelsShowcase, PublishSection, SecuritySection } from "@/components/landing/sections";
import { getSession } from "@/lib/server/session";

export default async function LandingPage() {
  const session = await getSession().catch(() => null);
  const signedIn = Boolean(session);
  return (
    <>
      <Hero signedIn={signedIn} />
      <BuildStory />
      <Capabilities />
      <ModelsShowcase />
      <ConnectorsStrip />
      <PublishSection />
      <SecuritySection />
      <PricingSection signedIn={signedIn} />
      <Faq />
      <FinalCta />
    </>
  );
}
