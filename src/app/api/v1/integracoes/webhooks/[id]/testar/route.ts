/** Envia o evento de teste a um webhook e devolve a entrega, com o que o destino respondeu (2026-10-29). */
import { integrationIdSchema } from "@/features/integrations/schemas";
import { testWebhook } from "@/features/integrations/service";
import { authorizeDomain, fromResult } from "@/lib/api/domain";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "webhook-test", "action", "webhooks:gerenciar");
  if ("response" in auth) return auth.response;

  const parsed = integrationIdSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "Webhook inválido" }, { status: 400 });

  return fromResult(await testWebhook(auth.session.supabase, auth.session.organizationId, parsed.data.id));
}
