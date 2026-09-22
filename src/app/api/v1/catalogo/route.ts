/**
 * O catálogo de produtos e serviços para o aplicativo. Mesma regra da web, pelo mesmo `service.ts`: aqui só muda a casca, que
 * autentica por Bearer em vez de sessão em cookie. A RLS continua decidindo o acesso, porque o cliente
 * carrega o JWT de quem pediu.
 */
import { parseCatalogQuery } from "@/features/catalog/list";
import { catalogFormSchema } from "@/features/catalog/schemas";
import { listCatalog, saveCatalogItem } from "@/features/catalog/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "catalog-read");
  if ("response" in auth) return auth.response;

  const params = new URL(request.url).searchParams;
  const page = await listCatalog(auth.session.supabase, auth.session.organizationId, parseCatalogQuery(Object.fromEntries(params)));
  return Response.json(page);
}

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "catalog-write");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, catalogFormSchema);
  if ("response" in body) return body.response;

  return fromMutation(await saveCatalogItem(auth.session.supabase, auth.session.organizationId, auth.session.userId, body.data), auth.session.organizationId, ["catalog"]);
}
