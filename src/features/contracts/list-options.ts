import type { Icon } from "@phosphor-icons/react";
import { TagIcon } from "@phosphor-icons/react/ssr";
import { remapPage } from "@/lib/utils/paging";
import { contractKinds, contractSources, contractStatuses } from "./labels";
import type { Contract, ContractKind, ContractSource, ContractStatus } from "./summary";

/**
 * O lado leve da listagem de contratos: nomes dos parâmetros, padrões, rótulos e a lista de filtros em vigor.
 * Separado de `list.ts` porque lá mora o zod que lê a URL no servidor, e a prancha é componente de cliente:
 * importar de lá levaria o zod inteiro para o navegador. Mesma divisão da base de clientes, do catálogo e
 * dos projetos.
 */

/**
 * Cada visão pede a página da medida dela (2026-10-26, no lugar da grade que media as colunas): trinta na
 * tabela e cem no funil, que mostra as etapas de uma vez, como o de orçamentos.
 */
export const CONTRACTS_PER_PAGE = 30;
export const FUNNEL_PER_PAGE = 100;
export const MAX_PER_PAGE = 100;

export { remapPage };

export const QUERY_PARAM = "busca";
export const STATUS_PARAM = "situacao";
export const SOURCE_PARAM = "origem";
export const KIND_PARAM = "tipo";
export const PAGE_PARAM = "pagina";
export const PAGE_SIZE_PARAM = "porPagina";

export const statusFilterValues = ["todos", "draft", "sent", "partial", "signed", "cancelled"] as const;
export const sourceFilterValues = ["todas", "pdf", "template", "scratch"] as const;
export const kindFilterValues = ["todos", "landing", "institutional", "ecommerce", "app", "branding", "uiux", "maintenance", "content", "other"] as const;

export type ContractsStatusFilter = (typeof statusFilterValues)[number];
export type ContractsSourceFilter = (typeof sourceFilterValues)[number];
export type ContractsKindFilter = (typeof kindFilterValues)[number];

/* Os padrões saem como o valor literal, e não como o tipo largo: é o que deixa a lista de filtros em vigor
   saber que, fora do padrão, situação, origem e tipo já não são "todos". */
export const DEFAULT_STATUS = "todos" satisfies ContractsStatusFilter;
export const DEFAULT_SOURCE = "todas" satisfies ContractsSourceFilter;
export const DEFAULT_KIND = "todos" satisfies ContractsKindFilter;

/* Rótulos num lugar só: o menu de filtros e a etiqueta do filtro em vigor dizem a mesma coisa. */
export const statusFilterLabels: Record<ContractsStatusFilter, string> = {
  todos: "Todas as situações",
  draft: contractStatuses.draft.label,
  sent: "Aguardando assinatura",
  partial: "Assinado por uma parte",
  signed: contractStatuses.signed.label,
  cancelled: contractStatuses.cancelled.label,
};

export const sourceFilterLabels: Record<ContractsSourceFilter, string> = {
  todas: "Todas as origens",
  pdf: contractSources.pdf.label,
  template: contractSources.template.label,
  scratch: contractSources.scratch.label,
};

export const kindFilterLabels: Record<ContractsKindFilter, string> = {
  todos: "Todos os tipos",
  landing: contractKinds.landing.label,
  institutional: contractKinds.institutional.label,
  ecommerce: contractKinds.ecommerce.label,
  app: contractKinds.app.label,
  branding: contractKinds.branding.label,
  uiux: contractKinds.uiux.label,
  maintenance: contractKinds.maintenance.label,
  content: contractKinds.content.label,
  other: contractKinds.other.label,
};

/** O que a URL carrega: o que a pessoa filtrou, em que página está e quantos por página. */
export type ContractsQuery = {
  search: string;
  status: ContractsStatusFilter;
  source: ContractsSourceFilter;
  kind: ContractsKindFilter;
  page: number;
  /** Quantos por página: trinta na tabela e cem no funil. Sem parâmetro, o servidor decide pelo cookie da visão. */
  pageSize: number;
};

export const defaultQuery: ContractsQuery = {
  search: "",
  status: DEFAULT_STATUS,
  source: DEFAULT_SOURCE,
  kind: DEFAULT_KIND,
  page: 1,
  pageSize: FUNNEL_PER_PAGE,
};

/** Um filtro fora do padrão: o glifo e o nome que a barra mostra, e o que devolve só ele ao padrão. */
export type ActiveContractsFilter = { id: string; label: string; icon: Icon; clear: Partial<ContractsQuery> };

/**
 * Os filtros fora do padrão, na ordem em que aparecem no menu. A barra mostra um por etiqueta, e a contagem
 * na quina do funil é o tamanho desta lista: um lugar só decide o que está em vigor.
 */
export function activeContractsFilters(query: ContractsQuery): ActiveContractsFilter[] {
  const list: ActiveContractsFilter[] = [];

  if (query.status !== DEFAULT_STATUS) {
    list.push({ id: "status", label: statusFilterLabels[query.status], icon: contractStatuses[query.status].icon, clear: { status: DEFAULT_STATUS } });
  }
  if (query.source !== DEFAULT_SOURCE) {
    list.push({ id: "source", label: sourceFilterLabels[query.source], icon: contractSources[query.source].icon, clear: { source: DEFAULT_SOURCE } });
  }
  if (query.kind !== DEFAULT_KIND) {
    list.push({ id: "kind", label: kindFilterLabels[query.kind], icon: TagIcon, clear: { kind: DEFAULT_KIND } });
  }

  return list;
}

/** Tudo de volta ao padrão, menos a busca: é o que "Limpar filtros" faz. */
export const clearedFilters: Partial<ContractsQuery> = {
  status: DEFAULT_STATUS,
  source: DEFAULT_SOURCE,
  kind: DEFAULT_KIND,
  page: 1,
};

/**
 * A página pronta: os contratos que o funil ou a tabela mostram, quantos contratos o filtro encontrou ao todo e quantos há
 * em cada situação, na base inteira, para o menu de filtros dizer o que existe.
 */
export type ContractsListPage = {
  items: Contract[];
  total: number;
  counts: Record<ContractStatus, number>;
};

export type { ContractKind, ContractSource };
