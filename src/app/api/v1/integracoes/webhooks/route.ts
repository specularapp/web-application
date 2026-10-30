/**
 * Os webhooks da equipe (2026-10-29), pela mesma regra da tela. Aceita a sessão de uma pessoa e também uma chave de
 * API com `webhooks:ler` para consultar e `webhooks:gerenciar` para cadastrar.
 */
import { webhookInputSchema } from "@/features/integrations/schemas";
import { createWebhook, listWebhooks } from "@/features/integrations/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "webhooks-read", "action", "webhooks:ler");
  if ("response" in auth) return auth.response;
  return Response.json({ webhooks: await listWebhooks(auth.session.supabase, auth.session.organizationId) });
}

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "webhook-create", "action", "webhooks:gerenciar");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, webhookInputSchema);
  if ("response" in body) return body.response;

  const { supabase, organizationId, userId } = auth.session;
  return fromMutation(await createWebhook(supabase, organizationId, userId, body.data), organizationId, []);
}
