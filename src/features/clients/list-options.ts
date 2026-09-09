import type { Icon } from "@phosphor-icons/react";
import { CalendarBlankIcon, EnvelopeSimpleIcon, MinusCircleIcon, PhoneIcon, StarIcon } from "@phosphor-icons/react/ssr";
import type { ListboxOption } from "@/components/ui/listbox";
import { gridPageSize as pageSizeForGrid } from "@/lib/utils/paging";
import type { Client } from "./summary";

/**
 * O lado leve da listagem de clientes: o modelo do cartão, os nomes dos parâmetros e as listas prontas
 * para os menus da barra. Separado de `list.ts` porque lá mora o zod que lê a URL no servidor, e a barra
 * é componente de cliente: importar de lá levaria o zod inteiro para o navegador.
 */

/**
 * O que o cartão da listagem precisa, e só isso. A ficha completa (`Client`) tem orçamentos, projetos,
 * anotações e etiquetas, e mandar tudo isso para cada um dos cartões de uma página encheria a carga com
 * o que a tela nem mostra. Quando a tabela existir, a consulta seleciona estas colunas e mais nenhuma.
 */
export type ClientListItem = Pick<
  Client,
  "id" | "reference" | "name" | "email" | "phone" | "avatarUrl" | "createdAt" | "company" | "city" | "active" | "favorite" | "stats"
>;

/** Trinta por página na tabela (2026-09-08, como no catálogo): a página só passa quando está completa. */
export const CLIENTS_PER_PAGE = 30;

/**
 * Na grade a página é o que cabe em até três linhas, e sempre par: a prancha mede quantas colunas a grade
 * formou e pede ao servidor esse tanto. Antes de medir, no servidor e na primeira visita, vale o que o
 * cookie guardou da última vez ou o padrão de quatro colunas.
 */
export const GRID_ROWS = 3;
export const GRID_PER_PAGE_DEFAULT = 12;
export const MAX_PER_PAGE = 30;

export const gridPageSize = (columns: number) => pageSizeForGrid(columns, GRID_ROWS, MAX_PER_PAGE);

export const QUERY_PARAM = "busca";
export const FAVORITE_PARAM = "favorito";
export const PERIOD_PARAM = "periodo";
export const STATUS_PARAM = "situacao";
export const EMAIL_PARAM = "email";
export const PHONE_PARAM = "telefone";
export const PAGE_PARAM = "pagina";
export const PAGE_SIZE_PARAM = "porPagina";

export const favoriteValues = ["todos", "favoritos", "outros"] as const;
export const statusValues = ["todos", "ativos", "inativos"] as const;
export const periodValues = ["30", "90", "sempre"] as const;

export type ClientsFavorite = (typeof favoriteValues)[number];
export type ClientsStatus = (typeof statusValues)[number];
export type ClientsPeriod = (typeof periodValues)[number];

/* Os padrões saem como o valor literal, e não como o tipo largo: é o que deixa a lista de filtros em
   vigor saber que, fora do padrão, favorito e situação já não são "todos". */
export const DEFAULT_FAVORITE = "todos" satisfies ClientsFavorite;
export const DEFAULT_STATUS = "todos" satisfies ClientsStatus;
export const DEFAULT_PERIOD = "30" satisfies ClientsPeriod;

/* Três períodos bastam: o mês corrente de trabalho, o trimestre e a base inteira (2026-09-08, a pedido).
   O rótulo mora num mapa, e não na lista de opções, porque a etiqueta do filtro em vigor diz a mesma
   coisa e um nome escrito em dois lugares sai de sincronia. */
const periodLabels: Record<ClientsPeriod, string> = {
  "30": "Últimos 30 dias",
  "90": "Últimos 90 dias",
  sempre: "Todo o período",
};

const favoriteLabels: Record<Exclude<ClientsFavorite, "todos">, string> = {
  favoritos: "Só favoritos",
  outros: "Sem favoritos",
};

const statusLabels: Record<Exclude<ClientsStatus, "todos">, string> = {
  ativos: "Só ativos",
  inativos: "Só inativos",
};

export const periodOptions: ListboxOption<ClientsPeriod>[] = periodValues.map((value) => ({
  value,
  label: periodLabels[value],
}));

/** O que a URL carrega: o que a pessoa filtrou e em que página está. */
export type ClientsQuery = {
  search: string;
  favorite: ClientsFavorite;
  status: ClientsStatus;
  period: ClientsPeriod;
  /** Só quem tem e-mail cadastrado. */
  withEmail: boolean;
  /** Só quem tem telefone cadastrado. */
  withPhone: boolean;
  page: number;
  /** Quantos por página: 30 na tabela; na grade, o que cabe em três linhas. Sem parâmetro, o servidor decide pela visão. */
  pageSize: number;
};

export const defaultQuery: ClientsQuery = {
  search: "",
  favorite: DEFAULT_FAVORITE,
  status: DEFAULT_STATUS,
  period: DEFAULT_PERIOD,
  withEmail: false,
  withPhone: false,
  page: 1,
  pageSize: CLIENTS_PER_PAGE,
};

/** Um filtro fora do padrão: o glifo e o nome que a barra mostra, e o que devolve só ele ao padrão. */
export type ActiveClientsFilter = { id: string; label: string; icon: Icon; clear: Partial<ClientsQuery> };

/**
 * Os filtros fora do padrão, na ordem em que aparecem no menu. A barra mostra um por etiqueta, e a
 * contagem na quina do funil é o tamanho desta lista: um lugar só decide o que está em vigor.
 */
export function activeClientsFilters(query: ClientsQuery): ActiveClientsFilter[] {
  const list: ActiveClientsFilter[] = [];

  if (query.period !== DEFAULT_PERIOD) {
    list.push({ id: "period", label: periodLabels[query.period], icon: CalendarBlankIcon, clear: { period: DEFAULT_PERIOD } });
  }
  if (query.favorite !== DEFAULT_FAVORITE) {
    list.push({ id: "favorite", label: favoriteLabels[query.favorite], icon: StarIcon, clear: { favorite: DEFAULT_FAVORITE } });
  }
  if (query.status !== DEFAULT_STATUS) {
    list.push({ id: "status", label: statusLabels[query.status], icon: MinusCircleIcon, clear: { status: DEFAULT_STATUS } });
  }
  if (query.withEmail) {
    list.push({ id: "email", label: "Com e-mail", icon: EnvelopeSimpleIcon, clear: { withEmail: false } });
  }
  if (query.withPhone) {
    list.push({ id: "phone", label: "Com telefone", icon: PhoneIcon, clear: { withPhone: false } });
  }

  return list;
}

/** Tudo de volta ao padrão, menos a busca: é o que "Limpar filtros" faz. */
export const clearedFilters: Partial<ClientsQuery> = {
  favorite: DEFAULT_FAVORITE,
  status: DEFAULT_STATUS,
  period: DEFAULT_PERIOD,
  withEmail: false,
  withPhone: false,
  page: 1,
};

/** A página pronta: os cartões que a grade mostra e quantos clientes o filtro encontrou ao todo. */
export type ClientsListPage = {
  items: ClientListItem[];
  total: number;
};
