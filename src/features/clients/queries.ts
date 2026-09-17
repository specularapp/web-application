import "server-only";
import { cacheKey, cacheTtl, cached } from "@/lib/cache";
import { cacheTags } from "@/lib/cache/tags";
import { requireOrganization } from "@/features/organizations/context";
import type { ClientsListPage, ClientsQuery } from "./list-options";
import { getClient, getClientsSummary, listClients, listClientOptions } from "./service";
import type { Client, ClientsSummary } from "./summary";

/* O que a URL pediu vira parte da chave: duas pessoas no mesmo filtro leem o mesmo bolo, e trocar o filtro
   abre outro. A ordem é fixa, senão a mesma pergunta geraria chaves diferentes. */
const queryKey = (query: ClientsQuery) =>
  [query.search, query.favorite, query.status, query.period, query.withEmail, query.withPhone, query.page, query.pageSize].join("|");

/** A página da listagem para a tela, já com a sessão e o time resolvidos. */
export async function getClientsPage(query: ClientsQuery, next = "/clientes"): Promise<ClientsListPage> {
  const { supabase, organizationId } = await requireOrganization(next);

  return cached(
    cacheKey(organizationId, "clients:list", queryKey(query)),
    { organizationId, tags: [cacheTags.clients], ttl: cacheTtl.list },
    () => listClients(supabase, organizationId, query),
  );
}

export async function getClientById(id: string, next = "/clientes"): Promise<Client | null> {
  const { supabase, organizationId } = await requireOrganization(next);
  return getClient(supabase, organizationId, id);
}

export async function getClientsBlock(next = "/dashboard"): Promise<ClientsSummary> {
  const { supabase, organizationId } = await requireOrganization(next);

  return cached(
    cacheKey(organizationId, "clients:block"),
    { organizationId, tags: [cacheTags.clients], ttl: cacheTtl.summary },
    () => getClientsSummary(supabase, organizationId),
  );
}

/** Os clientes que os seletores dos outros domínios oferecem. */
export async function getClientOptions(next = "/clientes") {
  const { supabase, organizationId } = await requireOrganization(next);

  return cached(
    cacheKey(organizationId, "clients:options"),
    { organizationId, tags: [cacheTags.clients], ttl: cacheTtl.summary },
    () => listClientOptions(supabase, organizationId),
  );
}
