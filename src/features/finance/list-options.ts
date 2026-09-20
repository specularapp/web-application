import type { Icon } from "@phosphor-icons/react";
import { gridPageSize as pageSizeForGrid, remapPage } from "@/lib/utils/paging";
import { chargeDirections, chargeMethods, chargeStatuses } from "./labels";
import type { Charge, ChargeDirection, ChargeMethod, ChargeStatus } from "./summary";

/**
 * O lado leve da listagem de cobranças: nomes dos parâmetros, padrões, rótulos e a lista de filtros em
 * vigor, sem zod, porque a prancha é componente de cliente. Mesma divisão das outras listas da casa.
 */

export const GRID_ROWS = 3;
export const GRID_PER_PAGE_DEFAULT = 12;
export const TABLE_PER_PAGE = 30;
export const MAX_PER_PAGE = 30;
export const MOBILE_PER_PAGE = 12;

export const gridPageSize = (columns: number) => pageSizeForGrid(columns, GRID_ROWS, MAX_PER_PAGE);

export { remapPage };

export const QUERY_PARAM = "busca";
export const DIRECTION_PARAM = "lado";
export const STATUS_PARAM = "situacao";
export const METHOD_PARAM = "forma";
export const PAGE_PARAM = "pagina";
export const PAGE_SIZE_PARAM = "porPagina";

/**
 * O lado da lista (2026-09-20, a pedido da despesa): tudo, o que a equipe recebe, ou o que ela paga. É
 * **segmento, e não filtro de leque**, porque a pergunta "estou olhando o que entra ou o que sai" vem antes
 * de qualquer outra: misturar os dois numa lista só faria a soma do rodapé mentir e a leitura de cor perder
 * o sentido. Por isso ele também não entra em `activeChargesFilters`, que é a fila de filtros a limpar.
 */
export const directionFilterValues = ["todas", "incoming", "outgoing"] as const;

export type ChargesDirectionFilter = (typeof directionFilterValues)[number];

export const DEFAULT_DIRECTION = "todas" satisfies ChargesDirectionFilter;

export const directionFilterLabels: Record<ChargesDirectionFilter, string> = {
  todas: "Tudo",
  incoming: chargeDirections.incoming.listLabel,
  outgoing: chargeDirections.outgoing.listLabel,
};

export const statusFilterValues = ["todas", "open", "partial", "overdue", "paid", "cancelled"] as const;
export const methodFilterValues = ["todas", "pix", "boleto", "transfer", "card"] as const;

export type ChargesStatusFilter = (typeof statusFilterValues)[number];
export type ChargesMethodFilter = (typeof methodFilterValues)[number];

export const DEFAULT_STATUS = "todas" satisfies ChargesStatusFilter;
export const DEFAULT_METHOD = "todas" satisfies ChargesMethodFilter;

export const statusFilterLabels: Record<ChargesStatusFilter, string> = {
  todas: "Todas as situações",
  open: chargeStatuses.open.label,
  partial: chargeStatuses.partial.label,
  overdue: chargeStatuses.overdue.label,
  paid: chargeStatuses.paid.label,
  cancelled: chargeStatuses.cancelled.label,
};

export const methodFilterLabels: Record<ChargesMethodFilter, string> = {
  todas: "Todas as formas",
  pix: chargeMethods.pix.label,
  boleto: chargeMethods.boleto.label,
  transfer: chargeMethods.transfer.label,
  card: chargeMethods.card.label,
};

export type ChargesQuery = {
  search: string;
  direction: ChargesDirectionFilter;
  status: ChargesStatusFilter;
  method: ChargesMethodFilter;
  page: number;
  pageSize: number;
};

export const defaultQuery: ChargesQuery = { search: "", direction: DEFAULT_DIRECTION, status: DEFAULT_STATUS, method: DEFAULT_METHOD, page: 1, pageSize: TABLE_PER_PAGE };

export type ChargesListPage = {
  items: Charge[];
  total: number;
  counts: Record<ChargeStatus, number>;
  /** Quantas de cada lado, para o segmento mostrar o tamanho de cada lista antes de ela ser aberta. */
  sides: Record<ChargeDirection, number>;
  /**
   * Quanto há por receber, quanto há por pagar e quanto está vencido dos dois lados, na base inteira, para a
   * barra dizer de relance. Separados de propósito: somar os dois num número só diria que a equipe tem mais
   * dinheiro a caminho do que tem.
   */
  totals: { receivable: number; payable: number; overdue: number };
};

export type ActiveChargesFilter = { id: string; label: string; icon: Icon; clear: Partial<ChargesQuery> };

export function activeChargesFilters(query: ChargesQuery): ActiveChargesFilter[] {
  const list: ActiveChargesFilter[] = [];
  if (query.status !== DEFAULT_STATUS) list.push({ id: "status", label: statusFilterLabels[query.status], icon: chargeStatuses[query.status].icon, clear: { status: DEFAULT_STATUS } });
  if (query.method !== DEFAULT_METHOD) list.push({ id: "method", label: methodFilterLabels[query.method], icon: chargeMethods[query.method as ChargeMethod].icon, clear: { method: DEFAULT_METHOD } });
  return list;
}

export const clearedFilters: Partial<ChargesQuery> = { status: DEFAULT_STATUS, method: DEFAULT_METHOD };
