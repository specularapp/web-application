/**
 * As automações para o aplicativo. Mesma regra da web, pelo mesmo `service.ts`: aqui só muda a casca, que
 * autentica por Bearer em vez de sessão em cookie. A RLS continua decidindo o acesso, porque o cliente
 * carrega o JWT de quem pediu.
 */
import { createAutomationSchema } from "@/features/automations/schemas";
import { createAutomation, listAutomations } from "@/features/automations/service";
import { authorizeDomain, fromResult, readPayload } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "automations-read");
  if ("response" in auth) return auth.response;

  const automations = await listAutomations(auth.session.supabase, auth.session.organizationId);
  return Response.json({ automations });
}

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "automations-write");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, createAutomationSchema);
  if ("response" in body) return body.response;

  return fromResult(await createAutomation(auth.session.supabase, auth.session.organizationId, auth.session.userId, body.data));
}
