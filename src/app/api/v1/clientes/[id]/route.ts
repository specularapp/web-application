/**
 * A ficha de um cliente para o aplicativo. Mesma regra da web, pelo mesmo `service.ts`: aqui só muda a casca, que
 * autentica por Bearer em vez de sessão em cookie. A RLS continua decidindo o acesso, porque o cliente
 * carrega o JWT de quem pediu.
 */
import { deleteClients, getClient } from "@/features/clients/service";
import { authorizeDomain, fromMutation } from "@/lib/api/domain";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "client-read");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const client = await getClient(auth.session.supabase, auth.session.organizationId, id);
  if (!client) return Response.json({ error: "Cliente não encontrado" }, { status: 404 });

  return Response.json(client);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "client-delete");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  return fromMutation(await deleteClients(auth.session.supabase, auth.session.organizationId, [id]), auth.session.organizationId, ["clients"]);
}
