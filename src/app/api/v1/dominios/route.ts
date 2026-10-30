/**
 * Os domínios do portfólio para o aplicativo (2026-10-29). Mesma regra da web, pelo mesmo serviço: aqui só muda a
 * casca, que autentica por Bearer em vez de sessão em cookie. A RLS continua decidindo quem mexe, e o plano é
 * conferido aqui como na action.
 */
import { planAllows } from "@/features/billing/service";
import { addPortfolioDomain, listPortfolioDomains } from "@/features/settings/domains-service";
import { domainNameSchema } from "@/features/settings/schemas";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "domain-load");
  if ("response" in auth) return auth.response;

  const overview = await listPortfolioDomains(auth.session.supabase, auth.session.organizationId);
  if (!overview) return Response.json({ error: "Time não encontrado" }, { status: 404 });
  return Response.json(overview);
}

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "domain-add");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, domainNameSchema);
  if ("response" in body) return body.response;

  const { supabase, organizationId, userId } = auth.session;
  if (!(await planAllows(supabase, organizationId, "custom_domain"))) return Response.json({ error: "Domínio próprio é do plano Pro." }, { status: 402 });

  return fromMutation(await addPortfolioDomain(supabase, organizationId, userId, body.data.domain), organizationId, ["organization"]);
}
