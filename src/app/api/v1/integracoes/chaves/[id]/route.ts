/** Editar ou excluir uma chave de API pelo aplicativo (2026-10-29). `enabled` no corpo pausa e reativa. */
import { apiKeyInputSchema, integrationIdSchema } from "@/features/integrations/schemas";
import { deleteApiKey, updateApiKey } from "@/features/integrations/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "api-key-update");
  if ("response" in auth) return auth.response;

  const parsed = integrationIdSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "Chave inválida" }, { status: 400 });

  const body = await readPayload(request, apiKeyInputSchema);
  if ("response" in body) return body.response;

  const { supabase, organizationId } = auth.session;
  return fromMutation(await updateApiKey(supabase, organizationId, parsed.data.id, body.data), organizationId, []);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "api-key-delete");
  if ("response" in auth) return auth.response;

  const parsed = integrationIdSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "Chave inválida" }, { status: 400 });

  return fromMutation(await deleteApiKey(auth.session.supabase, auth.session.organizationId, parsed.data.id), auth.session.organizationId, []);
}
