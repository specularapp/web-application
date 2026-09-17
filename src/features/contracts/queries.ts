import "server-only";
import { cacheKey, cacheTtl, cached } from "@/lib/cache";
import { cacheTags } from "@/lib/cache/tags";
import { requireOrganization } from "@/features/organizations/context";
import type { ContractsListPage, ContractsQuery } from "./list-options";
import { getContract, getContractLookups, listContracts, type ContractLookups } from "./service";
import type { Contract } from "./summary";

export type ContractsScreenData = { contracts: Contract[]; lookups: ContractLookups };

const queryKey = (query: ContractsQuery) =>
  [query.search, query.status, query.source, query.kind, query.page, query.pageSize].join("|");

/** A página da grade de contratos, filtrada e cortada no banco. */
export async function getContractsPage(query: ContractsQuery, next = "/contratos"): Promise<ContractsListPage> {
  const { supabase, organizationId } = await requireOrganization(next);

  return cached(
    cacheKey(organizationId, "contracts:list", queryKey(query)),
    { organizationId, tags: [cacheTags.contracts], ttl: cacheTtl.list },
    () => listContracts(supabase, organizationId, query),
  );
}

export async function getContractById(id: string, next = "/contratos"): Promise<Contract | null> {
  const { supabase, organizationId } = await requireOrganization(next);
  return getContract(supabase, organizationId, id);
}

/** As três bases que o editor oferece: clientes, projetos e orçamentos aprovados. */
export async function getContractLookupsData(next = "/contratos"): Promise<ContractLookups> {
  const { supabase, organizationId } = await requireOrganization(next);

  return cached(
    cacheKey(organizationId, "contracts:lookups"),
    { organizationId, tags: [cacheTags.contracts, cacheTags.clients, cacheTags.quotes], ttl: cacheTtl.summary },
    () => getContractLookups(supabase, organizationId),
  );
}
