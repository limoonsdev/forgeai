import { z } from "zod";
import { CREDIT_PACKS, PLANS } from "@/lib/config";
import { ensureCustomer, getStripe, planPriceId } from "@/lib/server/stripe";
import { absoluteUrl } from "@/lib/utils";
import { errorResponse, json, readJson, withApi } from "@/lib/server/api";

const Body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pack"), amountUsd: z.number().refine((n) => (CREDIT_PACKS as readonly number[]).includes(n), "Invalid pack") }),
  z.object({ kind: z.literal("plan"), plan: z.enum(["pro", "studio"]) }),
]);

export const POST = withApi(
  async (req, { auth }) => {
    const stripe = getStripe();
    if (!stripe) return errorResponse(503, "billing_disabled", "Payments are not configured on this server (STRIPE_SECRET_KEY).");
    const body = Body.parse(await readJson(req));
    const customer = await ensureCustomer(auth.userId);
    if (body.kind === "pack") {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: body.amountUsd * 100,
              product_data: { name: `Forged.dev credits — $${body.amountUsd}`, description: "AI credits, never expire" },
            },
          },
        ],
        metadata: { userId: auth.userId, kind: "pack", amountUsd: String(body.amountUsd) },
        success_url: absoluteUrl("/settings/billing?success=credits"),
        cancel_url: absoluteUrl("/settings/billing?canceled=1"),
        allow_promotion_codes: true,
      });
      return json({ url: session.url });
    }
    const price = planPriceId(body.plan);
    if (!price) return errorResponse(503, "plan_unavailable", `No Stripe price configured for the ${body.plan} plan.`);
    const def = PLANS.find((p) => p.id === body.plan)!;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [{ price, quantity: 1 }],
      metadata: { userId: auth.userId, kind: "plan", plan: def.id },
      subscription_data: { metadata: { userId: auth.userId, plan: def.id } },
      success_url: absoluteUrl("/settings/billing?success=plan"),
      cancel_url: absoluteUrl("/settings/billing?canceled=1"),
      allow_promotion_codes: true,
    });
    return json({ url: session.url });
  },
  {},
);
