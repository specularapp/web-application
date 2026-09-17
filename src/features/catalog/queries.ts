import "server-only";
import { cacheKey, cacheTtl, cached } from "@/lib/cache";
import { cacheTags } from "@/lib/cache/tags";
import { requireOrganization } from "@/features/organizations/context";
import type { CatalogListPage, CatalogQuery } from "./list-options";
import { getCatalogItem, listCatalog, listCatalogOptions } from "./service";
import type { CatalogItem } from "./summary";

const queryKey = (query: CatalogQuery) =>
  [query.search, query.kind, query.category, query.status, query.page, query.pageSize].join("|");

export async function getCatalogPage(query: CatalogQuery, next = "/catalogo"): Promise<CatalogListPage> {
  const { supabase, organizationId } = await requireOrganization(next);

  return cached(
    cacheKey(organizationId, "catalog:list", queryKey(query)),
    { organizationId, tags: [cacheTags.catalog], ttl: cacheTtl.list },
    () => listCatalog(supabase, organizationId, query),
  );
}

export async function getCatalogItemById(id: string, next = "/catalogo"): Promise<CatalogItem | null> {
  const { supabase, organizationId } = await requireOrganization(next);
  return getCatalogItem(supabase, organizationId, id);
}

/** Os itens que o editor de orçamento oferece. */
export async function getCatalogOptions(next = "/orcamentos"): Promise<CatalogItem[]> {
  const { supabase, organizationId } = await requireOrganization(next);

  return cached(
    cacheKey(organizationId, "catalog:options"),
    { organizationId, tags: [cacheTags.catalog], ttl: cacheTtl.summary },
    () => listCatalogOptions(supabase, organizationId),
  );
}
