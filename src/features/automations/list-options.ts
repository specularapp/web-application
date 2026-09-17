import type { Icon } from "@phosphor-icons/react";
import { automationStatuses } from "./labels";
import type { Automation, AutomationStatus } from "./summary";

/**
 * O lado leve da listagem de automações: nomes dos parâmetros, padrões, rótulos e a lista de filtros em
 * vigor, sem zod, porque a prancha é componente de cliente. A lista não pagina: automações são poucas por
 * conta, e a grade inteira cabe numa tela com rolagem.
 */

export const QUERY_PARAM = "busca";
export const STATUS_PARAM = "situacao";

export const statusFilterValues = ["todas", "active", "paused", "draft"] as const;

export type AutomationsStatusFilter = (typeof statusFilterValues)[number];

export const DEFAULT_STATUS = "todas" satisfies AutomationsStatusFilter;

export const statusFilterLabels: Record<AutomationsStatusFilter, string> = {
  todas: "Todas as situações",
  active: "Ativas",
  paused: "Pausadas",
  draft: "Rascunhos",
};

export type AutomationsQuery = {
  search: string;
  status: AutomationsStatusFilter;
};

export const defaultQuery: AutomationsQuery = { search: "", status: DEFAULT_STATUS };

export type AutomationsListPage = {
  items: Automation[];
  total: number;
  counts: Record<AutomationStatus, number>;
  /** Os modelos da casa que já viraram automação na conta, para a galeria dizer "instalado". */
  installed: string[];
};

export type ActiveAutomationsFilter = { id: string; label: string; icon: Icon; clear: Partial<AutomationsQuery> };

export function activeAutomationsFilters(query: AutomationsQuery): ActiveAutomationsFilter[] {
  if (query.status === DEFAULT_STATUS) return [];
  return [{ id: "status", label: statusFilterLabels[query.status], icon: automationStatuses[query.status].icon, clear: { status: DEFAULT_STATUS } }];
}

export const clearedFilters: Partial<AutomationsQuery> = { status: DEFAULT_STATUS };
