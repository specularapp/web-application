/** Reenvia uma entrega de webhook com o mesmo corpo e o mesmo id de evento (2026-10-29). */
import { integrationIdSchema } from "@/features/integrations/schemas";
import { redeliverWebhook } from "@/features/integrations/service";
import { authorizeDomain, fromResult } from "@/lib/api/domain";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "webhook-redeliver", "action", "webhooks:gerenciar");
  if ("response" in auth) return auth.response;

  const parsed = integrationIdSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "Entrega inválida" }, { status: 400 });

  return fromResult(await redeliverWebhook(auth.session.supabase, auth.session.organizationId, parsed.data.id));
}
