/** Editar ou apagar um webhook pelo aplicativo ou por chave com `webhooks:gerenciar` (2026-10-29). */
import { integrationIdSchema, webhookInputSchema } from "@/features/integrations/schemas";
import { deleteWebhook, updateWebhook } from "@/features/integrations/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "webhook-update", "action", "webhooks:gerenciar");
  if ("response" in auth) return auth.response;

  const parsed = integrationIdSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "Webhook inválido" }, { status: 400 });

  const body = await readPayload(request, webhookInputSchema);
  if ("response" in body) return body.response;

  const { supabase, organizationId } = auth.session;
  return fromMutation(await updateWebhook(supabase, organizationId, parsed.data.id, body.data), organizationId, []);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "webhook-delete", "action", "webhooks:gerenciar");
  if ("response" in auth) return auth.response;

  const parsed = integrationIdSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "Webhook inválido" }, { status: 400 });

  return fromMutation(await deleteWebhook(auth.session.supabase, auth.session.organizationId, parsed.data.id), auth.session.organizationId, []);
}
