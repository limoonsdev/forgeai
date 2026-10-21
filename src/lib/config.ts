import { usdToMicros } from "@/lib/utils";

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== "" ? n : fallback;
};

/** Business rules for the credit system. All money is in micro-dollars. */
export const CREDITS = {
  /** Free credits every new account receives. */
  signupBonusMicros: usdToMicros(num(process.env.SIGNUP_BONUS_USD, 1)),
  /** Credits the referrer earns once their friend forges a first app. */
  referrerRewardMicros: usdToMicros(num(process.env.REFERRAL_REWARD_USD, 5)),
  /** Credits the invited friend receives on sign-up. */
  refereeRewardMicros: usdToMicros(num(process.env.REFEREE_REWARD_USD, 5)),
  /** Minimum balance required to start an agent run. */
  minBalanceToRunMicros: usdToMicros(0.01),
  /** Multiplier applied on top of the provider cost (1.0 = at cost). */
  markup: num(process.env.CREDIT_MARKUP, 1.25),
} as const;

export type PlanId = "free" | "pro" | "studio";

export const PLANS: {
  id: PlanId;
  name: string;
  priceUsd: number;
  monthlyCreditsUsd: number;
  tagline: string;
  features: string[];
  highlighted?: boolean;
  stripePriceEnv?: string;
}[] = [
  {
    id: "free",
    name: "Free",
    priceUsd: 0,
    monthlyCreditsUsd: 0,
    tagline: "Kick the tyres and forge your first apps.",
    features: [
      "$1 of AI credits on sign-up",
      "+$5 for every friend you invite",
      "Live Next.js VM previews",
      "Claude, GPT, Gemini, Grok & open models",
      "Share links, REST API, skills",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceUsd: 20,
    monthlyCreditsUsd: 25,
    tagline: "For makers shipping every week.",
    highlighted: true,
    stripePriceEnv: "STRIPE_PRICE_PRO",
    features: [
      "$25 of AI credits every month",
      "Claude Fable 5.1 — the most capable model",
      "Everything in Free",
      "Unused credits never expire",
      "Priority support",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    priceUsd: 60,
    monthlyCreditsUsd: 80,
    tagline: "For agencies and power users.",
    stripePriceEnv: "STRIPE_PRICE_STUDIO",
    features: [
      "$80 of AI credits every month",
      "Best price per credit",
      "Everything in Pro",
      "Early access to new models",
      "Priority support",
    ],
  },
];

/** One-off credit top-ups (USD). */
export const CREDIT_PACKS = [10, 25, 50, 100] as const;

export const APP_NAME = "Forged.dev";
export const REF_COOKIE = "forged_ref";
