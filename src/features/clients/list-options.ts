import type { ListboxOption } from "@/components/ui/listbox";
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
  "id" | "reference" | "name" | "email" | "phone" | "avatarUrl" | "createdAt" | "company" | "active" | "favorite"
>;

/**
 * Quantos cartões cabem numa página: quatro linhas cheias da grade na largura de trabalho, que é onde a
 * lista ainda se varre com o olho sem virar rolagem sem fim. É múltiplo de 2, 3, 4 e 6, as colunas que a
 * grade forma nas larguras da casa, então a última linha raramente fica pela metade. A barra de
 * paginação só aparece passando disso: com menos, ela seria uma faixa sem função no pé da tela.
 */
export const CLIENTS_PER_PAGE = 24;

export const QUERY_PARAM = "busca";
export const SORT_PARAM = "ordem";
export const FAVORITE_PARAM = "favorito";
export const PERIOD_PARAM = "periodo";
export const STATUS_PARAM = "situacao";
export const EMAIL_PARAM = "email";
export const PHONE_PARAM = "telefone";
export const PAGE_PARAM = "pagina";

export const sortValues = ["az", "za", "recentes", "antigos"] as const;
export const favoriteValues = ["todos", "favoritos", "outros"] as const;
export const statusValues = ["todos", "ativos", "inativos"] as const;
export const periodValues = ["7", "30", "90", "365", "sempre"] as const;

export type ClientsSort = (typeof sortValues)[number];
export type ClientsFavorite = (typeof favoriteValues)[number];
export type ClientsStatus = (typeof statusValues)[number];
export type ClientsPeriod = (typeof periodValues)[number];

export const DEFAULT_SORT: ClientsSort = "az";
export const DEFAULT_FAVORITE: ClientsFavorite = "todos";
export const DEFAULT_STATUS: ClientsStatus = "todos";
export const DEFAULT_PERIOD: ClientsPeriod = "30";

export const sortOptions: ListboxOption<ClientsSort>[] = [
  { value: "az", label: "A-Z" },
  { value: "za", label: "Z-A" },
  { value: "recentes", label: "Mais recentes" },
  { value: "antigos", label: "Mais antigos" },
];

export const periodOptions: ListboxOption<ClientsPeriod>[] = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "365", label: "Últimos 12 meses" },
  { value: "sempre", label: "Todo o período" },
];

/** O que a URL carrega: o que a pessoa filtrou e em que página está. */
export type ClientsQuery = {
  search: string;
  sort: ClientsSort;
  favorite: ClientsFavorite;
  status: ClientsStatus;
  period: ClientsPeriod;
  /** Só quem tem e-mail cadastrado. */
  withEmail: boolean;
  /** Só quem tem telefone cadastrado. */
  withPhone: boolean;
  page: number;
};

export const defaultQuery: ClientsQuery = {
  search: "",
  sort: DEFAULT_SORT,
  favorite: DEFAULT_FAVORITE,
  status: DEFAULT_STATUS,
  period: DEFAULT_PERIOD,
  withEmail: false,
  withPhone: false,
  page: 1,
};

/** Quantos filtros saíram do padrão, para a etiqueta na quina do botão de filtros. */
export function countActiveFilters(query: ClientsQuery) {
  return [
    query.sort !== defaultQuery.sort,
    query.period !== defaultQuery.period,
    query.favorite !== defaultQuery.favorite,
    query.status !== defaultQuery.status,
    query.withEmail,
    query.withPhone,
  ].filter(Boolean).length;
}

/** Tudo de volta ao padrão, menos a busca: é o que "Limpar filtros" faz. */
export const clearedFilters: Partial<ClientsQuery> = {
  sort: DEFAULT_SORT,
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
