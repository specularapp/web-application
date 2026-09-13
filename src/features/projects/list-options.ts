import type { Icon } from "@phosphor-icons/react";
import { CalendarBlankIcon, TagIcon } from "@phosphor-icons/react/ssr";
import { catalogArtworkUrl, catalogHueFor } from "@/features/catalog/list-options";
import { gridPageSize as pageSizeForGrid, remapPage } from "@/lib/utils/paging";
import { projectStatuses } from "./labels";
import type { Project, ProjectHue, ProjectStatus } from "./summary";

/**
 * O lado leve da listagem de projetos: nomes dos parâmetros, padrões, rótulos e a lista de filtros em vigor.
 * Separado de `list.ts` porque lá mora o zod que lê a URL no servidor, e a prancha é componente de cliente:
 * importar de lá levaria o zod inteiro para o navegador. Mesma divisão da base de clientes e do catálogo.
 */

/**
 * A página é o que cabe em até três linhas da grade, e sempre par, na receita do catálogo: a prancha mede
 * quantas colunas a grade formou e pede ao servidor esse tanto. Antes de medir, no servidor e na primeira
 * visita, vale o que o cookie guardou da última vez ou o padrão de quatro colunas.
 */
export const GRID_ROWS = 3;
export const GRID_PER_PAGE_DEFAULT = 12;
export const MAX_PER_PAGE = 30;

/** No celular a página é sempre doze, como nas grades do catálogo e de clientes. */
export const MOBILE_PER_PAGE = 12;

export const gridPageSize = (columns: number) => pageSizeForGrid(columns, GRID_ROWS, MAX_PER_PAGE);

export { remapPage };

export const QUERY_PARAM = "busca";
export const STATUS_PARAM = "situacao";
export const DUE_PARAM = "entrega";
export const TAG_PARAM = "etiqueta";
export const PAGE_PARAM = "pagina";
export const PAGE_SIZE_PARAM = "porPagina";

export const statusFilterValues = ["todos", "active", "paused", "done", "cancelled"] as const;
export const dueFilterValues = ["qualquer", "7", "30", "atrasados"] as const;

export type ProjectsStatusFilter = (typeof statusFilterValues)[number];
export type ProjectsDueFilter = (typeof dueFilterValues)[number];

/* Os padrões saem como o valor literal, e não como o tipo largo: é o que deixa a lista de filtros em vigor
   saber que, fora do padrão, situação e entrega já não são "todos" e "qualquer". */
export const DEFAULT_STATUS = "todos" satisfies ProjectsStatusFilter;
export const DEFAULT_DUE = "qualquer" satisfies ProjectsDueFilter;
/** Etiqueta vazia é "todas": ela é texto livre, então não tem lista fechada de valores. */
export const DEFAULT_TAG = "";

/* Rótulos num lugar só: o menu de filtros e a etiqueta do filtro em vigor dizem a mesma coisa. */
export const statusFilterLabels: Record<ProjectsStatusFilter, string> = {
  todos: "Todas as situações",
  active: projectStatuses.active.label,
  paused: projectStatuses.paused.label,
  done: projectStatuses.done.label,
  cancelled: projectStatuses.cancelled.label,
};

/* Três janelas de entrega e os atrasados, na receita do prazo das tarefas: o que já venceu conta como dentro
   de qualquer janela, porque é o mais urgente que existe. */
export const dueFilterLabels: Record<ProjectsDueFilter, string> = {
  qualquer: "Qualquer entrega",
  "7": "Entrega em 7 dias",
  "30": "Entrega em 30 dias",
  atrasados: "Só atrasados",
};

/** O que a URL carrega: o que a pessoa filtrou, em que página está e quantos por página. */
export type ProjectsQuery = {
  search: string;
  status: ProjectsStatusFilter;
  due: ProjectsDueFilter;
  tag: string;
  page: number;
  /** Quantos por página: o que cabe em três linhas da grade. Sem parâmetro, o servidor decide pelo cookie. */
  pageSize: number;
};

export const defaultQuery: ProjectsQuery = {
  search: "",
  status: DEFAULT_STATUS,
  due: DEFAULT_DUE,
  tag: DEFAULT_TAG,
  page: 1,
  pageSize: GRID_PER_PAGE_DEFAULT,
};

/** Um filtro fora do padrão: o glifo e o nome que a barra mostra, e o que devolve só ele ao padrão. */
export type ActiveProjectsFilter = { id: string; label: string; icon: Icon; clear: Partial<ProjectsQuery> };

/**
 * Os filtros fora do padrão, na ordem em que aparecem no menu. A barra mostra um por etiqueta, e a contagem
 * na quina do funil é o tamanho desta lista: um lugar só decide o que está em vigor.
 */
export function activeProjectsFilters(query: ProjectsQuery): ActiveProjectsFilter[] {
  const list: ActiveProjectsFilter[] = [];

  if (query.status !== DEFAULT_STATUS) {
    list.push({ id: "status", label: statusFilterLabels[query.status], icon: projectStatuses[query.status].icon, clear: { status: DEFAULT_STATUS } });
  }
  if (query.due !== DEFAULT_DUE) {
    list.push({ id: "due", label: dueFilterLabels[query.due], icon: CalendarBlankIcon, clear: { due: DEFAULT_DUE } });
  }
  if (query.tag !== DEFAULT_TAG) {
    list.push({ id: "tag", label: query.tag, icon: TagIcon, clear: { tag: DEFAULT_TAG } });
  }

  return list;
}

/** Tudo de volta ao padrão, menos a busca: é o que "Limpar filtros" faz. */
export const clearedFilters: Partial<ProjectsQuery> = {
  status: DEFAULT_STATUS,
  due: DEFAULT_DUE,
  tag: DEFAULT_TAG,
  page: 1,
};

/**
 * A página pronta: os cartões que a grade mostra, quantos projetos o filtro encontrou ao todo, as etiquetas
 * que existem na base inteira, para o menu de filtros oferecer só o que tem, e quantos há em cada situação.
 */
export type ProjectsListPage = {
  items: Project[];
  total: number;
  tags: string[];
  counts: Record<ProjectStatus, number>;
};

/**
 * O matiz de um projeto nasce do nome, e não de uma escolha, pelo mesmo caminho do item sem foto do catálogo:
 * é o que tinge a capa enquanto a pessoa não anexa a imagem dela.
 */
export const projectHueFor = (name: string): ProjectHue => catalogHueFor(name);

/**
 * O endereço da arte gerada da capa sem imagem: a mesma rota `/api/artwork/[hue]/[token]` da arte do
 * catálogo, com o matiz do projeto no caminho e o token saindo do id, para o desenho não mudar quando o nome
 * muda.
 */
export const projectArtworkUrl = (project: Pick<Project, "id" | "hue">) => catalogArtworkUrl(project);
