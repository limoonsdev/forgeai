import { Hero } from "@/components/landing/hero";
import { ProductPreview } from "@/components/landing/product-preview";
import {
  FeaturesBento,
  FinalCta,
  HowItWorks,
  ModelsShowcase,
  NextOnly,
  ReferralBanner,
  StackMarquee,
  Faq,
} from "@/components/landing/sections";
import { PricingSection } from "@/components/landing/pricing";
import { getSession } from "@/lib/server/session";

export default async function LandingPage() {
  const session = await getSession().catch(() => null);
  const signedIn = Boolean(session);
  return (
    <>
      <Hero signedIn={signedIn} />
      <ProductPreview />
      <StackMarquee />
      <HowItWorks />
      <FeaturesBento />
      <ModelsShowcase />
      <NextOnly />
      <PricingSection signedIn={signedIn} />
      <ReferralBanner />
      <Faq />
      <FinalCta />
    </>
  );
}
