import "server-only";
import { cacheKey, cacheTtl, cached } from "@/lib/cache";
import { cacheTags } from "@/lib/cache/tags";
import { getOrganizationContext, requireOrganization } from "@/features/organizations/context";
import type { ClientsListPage, ClientsQuery } from "./list-options";
import { getClient, getClientsSummary, listClients, listClientOptions } from "./service";
import type { Client, ClientsSummary } from "./summary";

/* O que a URL pediu vira parte da chave: duas pessoas no mesmo filtro leem o mesmo bolo, e trocar o filtro
   abre outro. A ordem é fixa, senão a mesma pergunta geraria chaves diferentes.

   O grupo é o primeiro e não é enfeite: é ele que decide se a consulta traz clientes ou fornecedores, e sem
   ele na chave a aba de fornecedores servia a lista de clientes guardada trinta segundos antes, com o total
   errado na paginação (2026-09-22, na varredura). */
const queryKey = (query: ClientsQuery) =>
  [
    query.group,
    query.search,
    query.favorite,
    query.status,
    query.period,
    query.withEmail,
    query.withPhone,
    query.page,
    query.pageSize,
  ].join("|");

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

const EMPTY_BLOCK: ClientsSummary = { total: 0, clients: [] };

/* Como os demais blocos do painel: sem time o painel ainda abre, com a configuração inicial por cima. */
export async function getClientsBlock(): Promise<ClientsSummary> {
  const context = await getOrganizationContext();
  if (!context) return EMPTY_BLOCK;
  const { supabase, organizationId } = context;

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
