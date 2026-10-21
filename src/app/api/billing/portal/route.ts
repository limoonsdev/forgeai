import { ensureCustomer, getStripe } from "@/lib/server/stripe";
import { absoluteUrl } from "@/lib/utils";
import { errorResponse, json, withApi } from "@/lib/server/api";

export const POST = withApi(
  async (_req, { auth }) => {
    const stripe = getStripe();
    if (!stripe) return errorResponse(503, "billing_disabled", "Payments are not configured on this server.");
    const customer = await ensureCustomer(auth.userId);
    const portal = await stripe.billingPortal.sessions.create({ customer, return_url: absoluteUrl("/settings/billing") });
    return json({ url: portal.url });
  },
  { sessionOnly: true },
);
