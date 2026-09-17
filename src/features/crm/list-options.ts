import type { Icon } from "@phosphor-icons/react";
import { CalendarBlankIcon, CurrencyCircleDollarIcon, HourglassIcon, TextAaIcon, ThermometerIcon } from "@phosphor-icons/react/ssr";
import type { ListboxOption } from "@/components/ui/listbox";
import { temperatureLabels } from "./labels";
import type { CrmStage } from "./stages";
import type { Opportunity, OpportunityTemperature } from "./summary";

/**
 * O lado leve da listagem do funil: os nomes dos parâmetros, os padrões e as listas prontas para os menus.
 * Separado de `list.ts` porque lá mora o zod que lê a URL no servidor, e a prancha é componente de cliente:
 * importar de lá levaria o zod inteiro para o navegador. Mesma divisão do quadro de tarefas.
 */

export const QUERY_PARAM = "busca";
export const TEMPERATURE_PARAM = "temperatura";
export const HORIZON_PARAM = "previsao";
export const STALE_PARAM = "paradas";

export const temperatureFilterValues = ["todas", "cold", "warm", "hot"] as const;
export const horizonValues = ["7", "30", "sempre"] as const;

export type CrmTemperatureFilter = (typeof temperatureFilterValues)[number];
export type CrmHorizon = (typeof horizonValues)[number];

export const DEFAULT_TEMPERATURE = "todas" satisfies CrmTemperatureFilter;
export const DEFAULT_HORIZON = "sempre" satisfies CrmHorizon;

/* A previsão em três janelas: a semana, o mês e tudo. O quadro abre em tudo, porque coluna vazia por causa
   de um filtro que ninguém escolheu leria como quadro quebrado. */
const horizonLabels: Record<CrmHorizon, string> = {
  "7": "Fecham em 7 dias",
  "30": "Fecham em 30 dias",
  sempre: "Qualquer previsão",
};

export const horizonOptions: ListboxOption<CrmHorizon>[] = horizonValues.map((value) => ({ value, label: horizonLabels[value] }));

export const temperatureFilterLabels: Record<CrmTemperatureFilter, string> = {
  todas: "Todas as temperaturas",
  cold: temperatureLabels.cold,
  warm: temperatureLabels.warm,
  hot: temperatureLabels.hot,
};

/** O que a URL carrega: o que a pessoa filtrou. O quadro não tem página, então não há paginação aqui. */
export type CrmQuery = {
  search: string;
  temperature: CrmTemperatureFilter;
  horizon: CrmHorizon;
  /** Só o que está parado: em aberto e sem contato há mais de dez dias. */
  stale: boolean;
};

export const defaultCrmQuery: CrmQuery = {
  search: "",
  temperature: DEFAULT_TEMPERATURE,
  horizon: DEFAULT_HORIZON,
  stale: false,
};

/** Um filtro fora do padrão: o glifo e o nome que a barra mostra, e o que devolve só ele ao padrão. */
export type ActiveCrmFilter = { id: string; label: string; icon: Icon; clear: Partial<CrmQuery> };

/** Os filtros fora do padrão, na ordem em que aparecem no menu: um lugar só decide o que está em vigor. */
export function activeCrmFilters(query: CrmQuery): ActiveCrmFilter[] {
  const list: ActiveCrmFilter[] = [];

  if (query.temperature !== DEFAULT_TEMPERATURE) {
    list.push({
      id: "temperature",
      label: temperatureFilterLabels[query.temperature],
      icon: ThermometerIcon,
      clear: { temperature: DEFAULT_TEMPERATURE },
    });
  }
  if (query.horizon !== DEFAULT_HORIZON) {
    list.push({ id: "horizon", label: horizonLabels[query.horizon], icon: CalendarBlankIcon, clear: { horizon: DEFAULT_HORIZON } });
  }
  if (query.stale) {
    list.push({ id: "stale", label: "Só paradas", icon: HourglassIcon, clear: { stale: false } });
  }

  return list;
}

/** Tudo de volta ao padrão, menos a busca: é o que "Limpar filtros" faz. */
export const clearedCrmFilters: Partial<CrmQuery> = {
  temperature: DEFAULT_TEMPERATURE,
  horizon: DEFAULT_HORIZON,
  stale: false,
};

/**
 * Como as oportunidades de uma coluna são ordenadas por dentro. É escolha de coluna, e não do quadro: faz
 * sentido ver a proposta enviada pela previsão de fechamento e a negociação pelo valor, que é onde está o
 * dinheiro que dá para salvar.
 */
export const crmSortValues = ["expected", "value", "temperature", "title"] as const;

export type CrmColumnSort = (typeof crmSortValues)[number];

export const DEFAULT_CRM_SORT = "expected" satisfies CrmColumnSort;

export const crmSortLabels: Record<CrmColumnSort, string> = {
  expected: "Previsão",
  value: "Valor",
  temperature: "Temperatura",
  title: "Nome",
};

export const crmSortIcons: Record<CrmColumnSort, Icon> = {
  expected: CalendarBlankIcon,
  value: CurrencyCircleDollarIcon,
  temperature: ThermometerIcon,
  title: TextAaIcon,
};

/* O peso da temperatura em número, para a ordem descer da quente para a fria. */
const temperatureWeight: Record<OpportunityTemperature, number> = { hot: 0, warm: 1, cold: 2 };

/**
 * A ordem dentro de uma coluna. Por previsão é a mais próxima primeiro, que é a leitura natural de uma fila
 * de vendas a fechar; por valor é a maior primeiro, porque numa coluna de negociação o que se salva primeiro
 * é o que pesa mais; por temperatura desce da quente, com a previsão desempatando, senão a coluna
 * embaralharia entre iguais a cada carga; por nome é o alfabeto de pt-BR.
 *
 * Mora aqui, e não em `list.ts`, porque a prancha reordena a coluna na tela quando a pessoa escolhe no menu.
 */
export function sortCrmColumn(opportunities: Opportunity[], sort: CrmColumnSort = DEFAULT_CRM_SORT) {
  const ordered = [...opportunities];

  if (sort === "title") return ordered.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  if (sort === "value") return ordered.sort((a, b) => b.value - a.value || a.expectedAt.localeCompare(b.expectedAt));
  if (sort === "temperature") {
    return ordered.sort((a, b) => temperatureWeight[a.temperature] - temperatureWeight[b.temperature] || a.expectedAt.localeCompare(b.expectedAt));
  }
  return ordered.sort((a, b) => a.expectedAt.localeCompare(b.expectedAt));
}

/** Uma coluna do quadro: a etapa e as oportunidades dela que passaram pelo filtro. */
export type CrmColumn = { stage: CrmStage; opportunities: Opportunity[] };

/** O quadro pronto: as colunas na ordem das etapas e quantas oportunidades o filtro encontrou ao todo. */
export type CrmBoardData = {
  columns: CrmColumn[];
  /** Quantas passaram pelo filtro, somando as colunas: é o que o vazio da tela lê para saber o que dizer. */
  matched: number;
  /** Quantas existem na base, para separar "não achou nada" de "não tem nada". */
  total: number;
};
