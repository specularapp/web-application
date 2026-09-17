/**
 * Os contratos para o aplicativo. Mesma regra da web, pelo mesmo `service.ts`: aqui só muda a casca, que
 * autentica por Bearer em vez de sessão em cookie. A RLS continua decidindo o acesso, porque o cliente
 * carrega o JWT de quem pediu.
 */
import { parseContractsQuery } from "@/features/contracts/list";
import { createContractSchema } from "@/features/contracts/schemas";
import { createContract, listContracts } from "@/features/contracts/service";
import { authorizeDomain, fromResult, readPayload } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "contracts-read");
  if ("response" in auth) return auth.response;

  const params = new URL(request.url).searchParams;
  const page = await listContracts(auth.session.supabase, auth.session.organizationId, parseContractsQuery(Object.fromEntries(params)));
  return Response.json(page);
}

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "contracts-write");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, createContractSchema);
  if ("response" in body) return body.response;

  return fromResult(await createContract(auth.session.supabase, auth.session.organizationId, auth.session.userId, body.data));
}
