/**
 * As chaves de API da equipe (2026-10-29), pela mesma regra da tela. Só a sessão de uma pessoa entra aqui: uma
 * chave não cria nem lê outras chaves, por isso as rotas não declaram escopo.
 */
import { apiKeyInputSchema } from "@/features/integrations/schemas";
import { createApiKey, listApiKeys } from "@/features/integrations/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "api-keys-read");
  if ("response" in auth) return auth.response;
  return Response.json({ keys: await listApiKeys(auth.session.supabase, auth.session.organizationId) });
}

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "api-key-create");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, apiKeyInputSchema);
  if ("response" in body) return body.response;

  const { supabase, organizationId, userId } = auth.session;
  return fromMutation(await createApiKey(supabase, organizationId, userId, body.data), organizationId, []);
}
