import type Stripe from "stripe";
import { env } from "@/lib/env";
import { payloadTooLargeResponse, readTextWithLimit } from "@/lib/security/payload";
import { getStripe } from "@/lib/stripe/client";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Assinatura ausente", { status: 400 });

  let body: string;
  try {
    body = await readTextWithLimit(request);
  } catch {
    return payloadTooLargeResponse();
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, env.stripeWebhook().STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response("Assinatura inválida", { status: 400 });
  }

  return Response.json({ received: true, type: event.type });
}
