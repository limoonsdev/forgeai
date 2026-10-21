import "server-only";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { PLANS, type PlanId } from "@/lib/config";
import { usdToMicros } from "@/lib/utils";
import { grantCredits } from "./credits";

let client: Stripe | null = null;

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export function billingEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function planPriceId(plan: PlanId) {
  const def = PLANS.find((p) => p.id === plan);
  return def?.stripePriceEnv ? process.env[def.stripePriceEnv] : undefined;
}

function planFromPrice(priceId: string | undefined | null): PlanId | null {
  if (!priceId) return null;
  for (const p of PLANS) if (p.stripePriceEnv && process.env[p.stripePriceEnv] === priceId) return p.id;
  return null;
}

export async function ensureCustomer(userId: string) {
  const stripe = getStripe()!;
  const [u] = await db.select().from(user).where(eq(user.id, userId));
  if (!u) throw new Error("User not found");
  if (u.stripeCustomerId) return u.stripeCustomerId;
  const customer = await stripe.customers.create({ email: u.email, name: u.name, metadata: { userId } });
  await db.update(user).set({ stripeCustomerId: customer.id }).where(eq(user.id, userId));
  return customer.id;
}

async function userByCustomer(customerId: string | null | undefined) {
  if (!customerId) return null;
  const [u] = await db.select().from(user).where(eq(user.stripeCustomerId, customerId));
  return u ?? null;
}

/** Applies a verified Stripe webhook event. Every credit grant is idempotent (keyed by Stripe ids). */
export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (!userId) return;
      if (session.metadata?.kind === "pack" && session.payment_status === "paid") {
        const usd = Number(session.metadata.amountUsd);
        if (!Number.isFinite(usd) || usd <= 0) return;
        await grantCredits({
          userId,
          amountMicros: usdToMicros(usd),
          type: "purchase",
          description: `Credit pack: $${usd}`,
          reference: `stripe:checkout:${session.id}`,
          metadata: { sessionId: session.id },
        });
      }
      if (session.metadata?.kind === "plan" && session.subscription) {
        const plan = session.metadata.plan as PlanId;
        await db
          .update(user)
          .set({
            plan,
            stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription.id,
            stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
          })
          .where(eq(user.id, userId));
      }
      return;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      const u = await userByCustomer(customerId);
      if (!u) return;
      const line = invoice.lines?.data?.[0] as unknown as { pricing?: { price_details?: { price?: string } }; price?: { id?: string } } | undefined;
      const plan = planFromPrice(line?.pricing?.price_details?.price ?? line?.price?.id) ?? (u.plan as PlanId);
      const def = PLANS.find((p) => p.id === plan);
      if (!def || def.monthlyCreditsUsd <= 0) return;
      await grantCredits({
        userId: u.id,
        amountMicros: usdToMicros(def.monthlyCreditsUsd),
        type: "subscription",
        description: `${def.name} plan: monthly credits`,
        reference: `stripe:invoice:${invoice.id}`,
      });
      if (u.plan !== plan) await db.update(user).set({ plan }).where(eq(user.id, u.id));
      return;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      const u = await userByCustomer(typeof sub.customer === "string" ? sub.customer : sub.customer.id);
      if (!u) return;
      const item = sub.items.data[0] as unknown as { price?: { id?: string }; current_period_end?: number };
      const plan = planFromPrice(item?.price?.id);
      const active = sub.status === "active" || sub.status === "trialing";
      await db
        .update(user)
        .set({
          plan: active && plan ? plan : "free",
          stripeSubscriptionId: sub.id,
          planRenewsAt: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
        })
        .where(eq(user.id, u.id));
      return;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const u = await userByCustomer(typeof sub.customer === "string" ? sub.customer : sub.customer.id);
      if (u) await db.update(user).set({ plan: "free", stripeSubscriptionId: null, planRenewsAt: null }).where(eq(user.id, u.id));
      return;
    }
  }
}
