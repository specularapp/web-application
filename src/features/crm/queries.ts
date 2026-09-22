import "server-only";
import { cacheKey, cacheTtl, cached } from "@/lib/cache";
import { cacheTags } from "@/lib/cache/tags";
import { requireOrganization } from "@/features/organizations/context";
import type { CrmQuery } from "./list-options";
import { getCrmTree, listCrmClients, listCrmPeople, listOpportunities } from "./service";
import type { CrmClientOption, CrmPerson, Opportunity } from "./summary";
import { findFunnel, flattenFunnels, type CrmFunnel, type CrmTreeNode } from "./tree";

export type CrmScreenData = {
  opportunities: Opportunity[];
  team: CrmPerson[];
  clients: CrmClientOption[];
  funnels: CrmFunnel[];
  tree: CrmTreeNode[];
  /** O funil do endereço, quando a página é a de um; nulo no quadro de todas. */
  funnel: CrmFunnel | null;
};

/**
 * O que o quadro precisa de uma vez: as oportunidades, a equipe dos seletores e a arquitetura. O funil sai
 * da árvore pelo endereço, e não de uma consulta à parte, porque a árvore já veio e a página precisa dela.
 * As três leituras passam pelo cache, com a chave carregando o funil e o que a URL filtrou.
 */
export async function loadCrmScreenData(query: CrmQuery, slug?: string, next = "/crm"): Promise<CrmScreenData> {
  const { supabase, organizationId } = await requireOrganization(next);

  const tree = await cached(
    cacheKey(organizationId, "crm:tree"),
    { organizationId, tags: [cacheTags.crm], ttl: cacheTtl.shell },
    () => getCrmTree(supabase, organizationId),
  );

  const funnel = slug ? findFunnel(tree, slug) : null;

  const [opportunities, team, clients] = await Promise.all([
    cached(
      cacheKey(organizationId, "crm:board", slug ?? "todos", query.search, query.temperature, query.horizon, query.stale),
      { organizationId, tags: [cacheTags.crm], ttl: cacheTtl.list },
      () => listOpportunities(supabase, organizationId, query, funnel ?? undefined),
    ),
    cached(
      cacheKey(organizationId, "crm:people"),
      { organizationId, tags: [cacheTags.organization], ttl: cacheTtl.summary },
      () => listCrmPeople(supabase, organizationId),
    ),
    cached(
      cacheKey(organizationId, "crm:clients"),
      { organizationId, tags: [cacheTags.clients], ttl: cacheTtl.summary },
      () => listCrmClients(supabase, organizationId),
    ),
  ]);

  return { opportunities, team, clients, funnels: flattenFunnels(tree), tree, funnel };
}

/** Só a arquitetura, que é o que a concha precisa para desenhar o menu. */
export async function getCrmTreeData(next = "/crm"): Promise<CrmTreeNode[]> {
  const { supabase, organizationId } = await requireOrganization(next);

  return cached(
    cacheKey(organizationId, "crm:tree"),
    { organizationId, tags: [cacheTags.crm], ttl: cacheTtl.shell },
    () => getCrmTree(supabase, organizationId),
  );
}
