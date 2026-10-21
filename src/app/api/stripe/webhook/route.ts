import { getStripe, handleStripeEvent } from "@/lib/server/stripe";

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return new Response("Billing not configured", { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  const raw = await req.text();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, secret);
  } catch (err) {
    return new Response(`Invalid signature: ${(err as Error).message}`, { status: 400 });
  }
  try {
    await handleStripeEvent(event);
  } catch (err) {
    console.error("[stripe] webhook handling failed", err);
    return new Response("Webhook handler error", { status: 500 });
  }
  return Response.json({ received: true });
}
