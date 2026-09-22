/**
 * O funil de vendas para o aplicativo. Mesma regra da web, pelo mesmo `service.ts`: aqui só muda a casca, que
 * autentica por Bearer em vez de sessão em cookie. A RLS continua decidindo o acesso, porque o cliente
 * carrega o JWT de quem pediu.
 */
import { parseCrmQuery } from "@/features/crm/list";
import { opportunityFormSchema } from "@/features/crm/schemas";
import { getCrmTree, listOpportunities, saveOpportunity } from "@/features/crm/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "crm-read");
  if ("response" in auth) return auth.response;

  const params = new URL(request.url).searchParams;
  const [opportunities, tree] = await Promise.all([
    listOpportunities(auth.session.supabase, auth.session.organizationId, parseCrmQuery(Object.fromEntries(params))),
    getCrmTree(auth.session.supabase, auth.session.organizationId),
  ]);

  return Response.json({ opportunities, tree });
}

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "crm-write");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, opportunityFormSchema);
  if ("response" in body) return body.response;

  return fromMutation(await saveOpportunity(auth.session.supabase, auth.session.organizationId, body.data), auth.session.organizationId, ["crm"]);
}
