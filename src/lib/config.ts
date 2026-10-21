import { usdToMicros } from "@/lib/utils";

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== "" ? n : fallback;
};

/** Business rules for the credit system. All money is in micro-dollars. */
export const CREDITS = {
  /** Free credits every new account receives (after email verification). */
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

export type PlanId = "free" | "starter" | "pro" | "studio";

export type PlanLimits = {
  /** Live deployments on a forged subdomain. */
  deployments: number;
  /** Sub-agents the coordinator may run in parallel. */
  parallelAgents: number;
  /** Position boost in the VM queue when the server is busy. */
  queuePriority: number;
};

export const PLANS: {
  id: PlanId;
  name: string;
  priceUsd: number;
  monthlyCreditsUsd: number;
  tagline: string;
  features: string[];
  limits: PlanLimits;
  highlighted?: boolean;
  stripePriceEnv?: string;
}[] = [
  {
    id: "free",
    name: "Free",
    priceUsd: 0,
    monthlyCreditsUsd: 0,
    tagline: "Try it on a real project.",
    limits: { deployments: 1, parallelAgents: 2, queuePriority: 0 },
    features: ["$1 of credits after email verification", "$5 for every friend who signs up", "All standard models", "1 published app", "2 parallel sub-agents"],
  },
  {
    id: "starter",
    name: "Starter",
    priceUsd: 10,
    monthlyCreditsUsd: 10,
    tagline: "For side projects.",
    limits: { deployments: 3, parallelAgents: 3, queuePriority: 1 },
    stripePriceEnv: "STRIPE_PRICE_STARTER",
    features: ["$10 of credits each month", "3 published apps", "3 parallel sub-agents", "Priority in the VM queue"],
  },
  {
    id: "pro",
    name: "Pro",
    priceUsd: 25,
    monthlyCreditsUsd: 28,
    tagline: "For people who ship every week.",
    highlighted: true,
    limits: { deployments: 10, parallelAgents: 4, queuePriority: 2 },
    stripePriceEnv: "STRIPE_PRICE_PRO",
    features: ["$28 of credits each month", "Claude Fable 5.1", "10 published apps", "4 parallel sub-agents", "Higher queue priority"],
  },
  {
    id: "studio",
    name: "Studio",
    priceUsd: 70,
    monthlyCreditsUsd: 85,
    tagline: "For agencies and heavy users.",
    limits: { deployments: 30, parallelAgents: 6, queuePriority: 3 },
    stripePriceEnv: "STRIPE_PRICE_STUDIO",
    features: ["$85 of credits each month", "Everything in Pro", "30 published apps", "6 parallel sub-agents", "Top queue priority"],
  },
];

export function planLimits(plan: string): PlanLimits {
  return (PLANS.find((p) => p.id === plan) ?? PLANS[0]).limits;
}

/** Payments are switched off until Stripe is live. Plans are shown as "coming soon". */
export const PAYMENTS_ENABLED = process.env.PAYMENTS_ENABLED === "true" && Boolean(process.env.STRIPE_SECRET_KEY);

/** One-off credit top-ups (USD). */
export const CREDIT_PACKS = [10, 25, 50, 100] as const;

export const APP_NAME = "Forged.dev";
export const REF_COOKIE = "forged_ref";
