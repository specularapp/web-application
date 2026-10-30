/** Gira o segredo de assinatura de um webhook e devolve o novo, que só aparece nesta resposta (2026-10-29). */
import { integrationIdSchema } from "@/features/integrations/schemas";
import { rotateWebhookSecret } from "@/features/integrations/service";
import { authorizeDomain, fromMutation } from "@/lib/api/domain";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "webhook-rotate", "action", "webhooks:gerenciar");
  if ("response" in auth) return auth.response;

  const parsed = integrationIdSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "Webhook inválido" }, { status: 400 });

  return fromMutation(await rotateWebhookSecret(auth.session.supabase, auth.session.organizationId, parsed.data.id), auth.session.organizationId, []);
}
