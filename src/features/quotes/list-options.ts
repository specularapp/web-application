import type { Icon } from "@phosphor-icons/react";
import { CalendarBlankIcon, TagIcon } from "@phosphor-icons/react/ssr";
import type { ListboxOption } from "@/components/ui/listbox";
import { quoteStatuses } from "./labels";
import type { Quote, QuoteStatus } from "./summary";

/**
 * O lado leve da listagem de orçamentos: nomes dos parâmetros, padrões, rótulos e a lista de filtros em
 * vigor. Separado de `list.ts` porque lá mora o zod que lê a URL no servidor, e a prancha é componente de
 * cliente. Mesma divisão da base de clientes e do catálogo.
 */

/** Trinta por página, como nas outras listas em tabela: a página só passa quando está completa. */
export const QUOTES_PER_PAGE = 30;
/** No celular a tabela rola na horizontal e a página é doze, como nas grades do catálogo e de clientes. */
export const MOBILE_PER_PAGE = 12;
export const MAX_PER_PAGE = 30;

export const QUERY_PARAM = "busca";
export const STATUS_PARAM = "situacao";
export const PERIOD_PARAM = "periodo";
export const PAGE_PARAM = "pagina";
export const PAGE_SIZE_PARAM = "porPagina";

export const statusFilterValues = ["todos", "draft", "sent", "viewed", "approved", "declined", "expired"] as const;
export const periodValues = ["30", "90", "sempre"] as const;

export type QuotesStatusFilter = (typeof statusFilterValues)[number];
export type QuotesPeriod = (typeof periodValues)[number];

export const DEFAULT_STATUS = "todos" satisfies QuotesStatusFilter;
export const DEFAULT_PERIOD = "sempre" satisfies QuotesPeriod;

const periodLabels: Record<QuotesPeriod, string> = {
  "30": "Últimos 30 dias",
  "90": "Últimos 90 dias",
  sempre: "Todo o período",
};

export const periodOptions: ListboxOption<QuotesPeriod>[] = periodValues.map((value) => ({ value, label: periodLabels[value] }));

export const statusFilterLabels: Record<QuotesStatusFilter, string> = {
  todos: "Todas as situações",
  draft: quoteStatuses.draft.label,
  sent: quoteStatuses.sent.label,
  viewed: quoteStatuses.viewed.label,
  approved: quoteStatuses.approved.label,
  declined: quoteStatuses.declined.label,
  expired: quoteStatuses.expired.label,
};

/** O que a URL carrega: o que a pessoa filtrou, em que página está e quantos por página. */
export type QuotesQuery = {
  search: string;
  status: QuotesStatusFilter;
  period: QuotesPeriod;
  page: number;
  pageSize: number;
};

export const defaultQuery: QuotesQuery = {
  search: "",
  status: DEFAULT_STATUS,
  period: DEFAULT_PERIOD,
  page: 1,
  pageSize: QUOTES_PER_PAGE,
};

/** Um filtro fora do padrão: o glifo e o nome que a barra mostra, e o que devolve só ele ao padrão. */
export type ActiveQuotesFilter = { id: string; label: string; icon: Icon; clear: Partial<QuotesQuery> };

export function activeQuotesFilters(query: QuotesQuery): ActiveQuotesFilter[] {
  const list: ActiveQuotesFilter[] = [];
  if (query.status !== DEFAULT_STATUS) {
    list.push({ id: "status", label: statusFilterLabels[query.status], icon: quoteStatuses[query.status].icon, clear: { status: DEFAULT_STATUS } });
  }
  if (query.period !== DEFAULT_PERIOD) {
    list.push({ id: "period", label: periodLabels[query.period], icon: CalendarBlankIcon, clear: { period: DEFAULT_PERIOD } });
  }
  return list;
}

/** Tudo de volta ao padrão, menos a busca: é o que "Limpar filtros" faz. */
export const clearedFilters: Partial<QuotesQuery> = {
  status: DEFAULT_STATUS,
  period: DEFAULT_PERIOD,
  page: 1,
};

/** A página pronta: os orçamentos da página, quantos o filtro encontrou ao todo e os totais da base para o pé. */
export type QuotesListPage = {
  items: Quote[];
  total: number;
  /** Quantos há em cada situação na base inteira, para o menu de filtros dizer o que tem. */
  counts: Record<QuoteStatus, number>;
};

/** O glifo da linha na tabela e no menu quando o orçamento não tem outro. */
export const quoteGlyph: Icon = TagIcon;

/** A situação que uma leitura do cliente produz, e o que aprovar ou recusar produz. */
export function nextStatus(current: QuoteStatus, event: "view" | "approve" | "decline"): QuoteStatus {
  if (event === "approve") return "approved";
  if (event === "decline") return "declined";
  return current === "sent" ? "viewed" : current;
}
