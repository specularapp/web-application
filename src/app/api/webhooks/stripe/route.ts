import type Stripe from "stripe";
import {
  applySetupIntentEvent,
  applySubscriptionEvent,
  eventAlreadyHandled,
  recordEvent,
  subscriptionIdOfInvoice,
} from "@/features/billing/service";
import { env } from "@/lib/env";
import { payloadTooLargeResponse, readTextWithLimit } from "@/lib/security/payload";
import { getStripe } from "@/lib/stripe/client";

/**
 * `applied` gravou; `ignored` é evento que não nos interessa ou que nunca vai dar para aplicar (cliente
 * apagado, organização que não existe mais), e por isso responde 2xx: insistir nele só encheria a fila
 * de reentrega do Stripe. Falha de escrita não passa por aqui, ela sobe como exceção e vira 500.
 */
type Result = { outcome: "applied" | "ignored"; organizationId: string | null };

function settle(organizationId: string | null): Result {
  return organizationId ? { outcome: "applied", organizationId } : { outcome: "ignored", organizationId: null };
}

async function handle(event: Stripe.Event): Promise<Result> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
    case "customer.subscription.trial_will_end":
      return settle(await applySubscriptionEvent(event.data.object.id));

    // Fatura paga, recusada ou anulada muda o status da assinatura, e o status é o que decide o plano
    // em vigor. Em vez de deduzir do corpo do evento, relemos a assinatura, que é a fonte.
    case "invoice.paid":
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
    case "invoice.marked_uncollectible":
    case "invoice.voided": {
      const subscriptionId = subscriptionIdOfInvoice(event.data.object);
      if (!subscriptionId) return { outcome: "ignored", organizationId: null };
      return settle(await applySubscriptionEvent(subscriptionId));
    }

    case "setup_intent.succeeded":
      return settle(await applySetupIntentEvent(event.data.object.id));

    default:
      return { outcome: "ignored", organizationId: null };
  }
}

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
    event = await getStripe().webhooks.constructEventAsync(
      body,
      signature,
      env.stripeWebhook().STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return new Response("Assinatura inválida", { status: 400 });
  }

  if (await eventAlreadyHandled(event.id)) return Response.json({ received: true, duplicate: true });

  let result: Result;
  try {
    result = await handle(event);
  } catch (error) {
    // 500 faz o Stripe reentregar, que é o que queremos quando a escrita falhou.
    console.error("[stripe webhook]", event.type, error);
    return new Response("Falha ao processar", { status: 500 });
  }

  await recordEvent({
    id: event.id,
    type: event.type,
    organizationId: result.organizationId,
    outcome: result.outcome,
  });

  return Response.json({ received: true, outcome: result.outcome });
}
