import "server-only";
import { getCatalogOptions } from "@/features/catalog/queries";
import type { CatalogItem } from "@/features/catalog/summary";
import type { ClientListItem } from "@/features/clients/list-options";
import { getClientOptions } from "@/features/clients/queries";
import { cacheKey, cacheTtl, cached } from "@/lib/cache";
import { cacheTags } from "@/lib/cache/tags";
import { requireOrganization } from "@/features/organizations/context";
import { getIssuer } from "@/features/organizations/service";
import { listQuotes, nextQuoteNumber } from "./service";
import type { QuotesListPage, QuotesQuery } from "./list-options";
import type { QuoteIssuer, QuotePerson } from "./summary";

/** Um cliente como o editor de orçamento o oferece: o que a linha da lista desenha, e nada além. */
export type QuoteClientOption = ClientListItem;

export type QuotesScreenData = {
  page: QuotesListPage;
  issuer: QuoteIssuer;
  owner: QuotePerson;
  nextNumber: string;
  clients: QuoteClientOption[];
  catalog: CatalogItem[];
};

/**
 * O que a tela de orçamentos precisa de uma vez: a página da lista, quem emite (a equipe em vigor), quem
 * responde (a pessoa na sessão), o próximo número e as duas bases que o editor oferece.
 */
/**
 * O que o **editor** precisa, e só isso: a lista de clientes, o catálogo, quem emite, quem responde e o
 * próximo número. Sem a página da lista, que o editor deixou de mostrar atrás de si quando virou tela
 * (2026-09-16): carregá-la ali era uma consulta paga por nada.
 */
export async function loadQuoteEditorData(next = "/orcamentos") {
  const { supabase, organizationId, user } = await requireOrganization(next);

  const [issuer, nextNumber, clients, catalog, profile] = await Promise.all([
    getIssuer(supabase, organizationId),
    nextQuoteNumber(supabase, organizationId),
    getClientOptions(next),
    getCatalogOptions(next),
    supabase.from("profiles").select("full_name, email, avatar_url").eq("id", user.id).maybeSingle(),
  ]);

  return {
    issuer,
    owner: {
      name: profile.data?.full_name || profile.data?.email || "Você",
      avatarUrl: profile.data?.avatar_url ?? null,
    },
    nextNumber,
    clients,
    catalog,
  };
}

export async function loadQuotesScreenData(query: QuotesQuery, next = "/orcamentos"): Promise<QuotesScreenData> {
  const { supabase, organizationId, user } = await requireOrganization(next);

  const [page, issuer, nextNumber, clients, catalog, profile] = await Promise.all([
    cached(
      cacheKey(organizationId, "quotes:list", query.search, query.status, query.period, query.page, query.pageSize),
      { organizationId, tags: [cacheTags.quotes], ttl: cacheTtl.list },
      () => listQuotes(supabase, organizationId, query),
    ),
    getIssuer(supabase, organizationId),
    nextQuoteNumber(supabase, organizationId),
    getClientOptions(next),
    getCatalogOptions(next),
    supabase.from("profiles").select("full_name, email, avatar_url").eq("id", user.id).maybeSingle(),
  ]);

  return {
    page,
    issuer,
    owner: {
      name: profile.data?.full_name || profile.data?.email || "Você",
      avatarUrl: profile.data?.avatar_url ?? null,
    },
    nextNumber,
    clients,
    catalog,
  };
}
