import { env } from "@/lib/env";
import { getResend } from "@/lib/resend/client";
import { payloadTooLargeResponse, readTextWithLimit } from "@/lib/security/payload";

export async function POST(request: Request) {
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return new Response("Assinatura ausente", { status: 400 });

  let payload: string;
  try {
    payload = await readTextWithLimit(request);
  } catch {
    return payloadTooLargeResponse();
  }

  try {
    const event = getResend().webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret: env.resendWebhook().RESEND_WEBHOOK_SECRET,
    });
    return Response.json({ received: true, type: event.type });
  } catch {
    return new Response("Assinatura inválida", { status: 400 });
  }
}
