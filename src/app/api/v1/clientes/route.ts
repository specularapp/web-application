/**
 * A base de clientes para o aplicativo. Mesma regra da web, pelo mesmo `service.ts`: aqui só muda a casca, que
 * autentica por Bearer em vez de sessão em cookie. A RLS continua decidindo o acesso, porque o cliente
 * carrega o JWT de quem pediu.
 */
import { parseClientsQuery } from "@/features/clients/list";
import { clientFormSchema } from "@/features/clients/schemas";
import { listClients, saveClient } from "@/features/clients/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "clients-read");
  if ("response" in auth) return auth.response;

  const params = new URL(request.url).searchParams;
  const query = parseClientsQuery(Object.fromEntries(params));

  const page = await listClients(auth.session.supabase, auth.session.organizationId, query);
  return Response.json(page);
}

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "clients-write");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, clientFormSchema);
  if ("response" in body) return body.response;

  return fromMutation(await saveClient(auth.session.supabase, auth.session.organizationId, auth.session.userId, body.data), auth.session.organizationId, ["clients"]);
}
