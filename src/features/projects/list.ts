import { differenceInCalendarDays, parseISO } from "date-fns";
import { z } from "zod";
import { slugify } from "@/lib/utils/slug";
import {
  GRID_PER_PAGE_DEFAULT,
  MAX_PER_PAGE,
  defaultQuery,
  dueFilterValues,
  statusFilterValues,
  type ProjectsDueFilter,
  type ProjectsListPage,
  type ProjectsQuery,
} from "./list-options";
import { siteLabel } from "./labels";
import type { Project, ProjectStatus } from "./summary";

/* O nome do cookie da grade e a escrita dele moram em `grid-cookie.ts`, que não carrega zod. Segue saindo
   daqui para quem lê a listagem no servidor. */
export { PROJECTS_GRID_COOKIE } from "./grid-cookie";

/**
 * A regra da listagem de projetos: ler o que a URL pede, filtrar, ordenar e cortar a página. Roda no
 * servidor, porque parâmetro de URL é entrada de usuário e a lista virá do banco. Recebe os projetos de fora
 * e não sabe de onde vêm, então trocar a prévia pela consulta não mexe em nada daqui.
 */

/* Valor fora da lista cai no padrão em vez de derrubar a página: a URL é digitável e vem de link antigo. */
const querySchema = z.object({
  search: z.string().trim().max(80).catch(""),
  status: z.enum(statusFilterValues).catch(defaultQuery.status),
  due: z.enum(dueFilterValues).catch(defaultQuery.due),
  tag: z.string().trim().max(40).catch(defaultQuery.tag),
  page: z.coerce.number().int().min(1).max(9999).catch(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PER_PAGE).optional().catch(undefined),
});

/** Lê o cookie do tamanho da grade: só um par entre 2 e o máximo vale; o resto cai no padrão. */
export function parseProjectsGridSize(raw: string | undefined) {
  return z.coerce.number().int().min(2).max(MAX_PER_PAGE).multipleOf(2).catch(GRID_PER_PAGE_DEFAULT).parse(raw);
}

export function parseProjectsQuery(params: Record<string, string | undefined>, fallbackPageSize = GRID_PER_PAGE_DEFAULT): ProjectsQuery {
  const { pageSize, ...rest } = querySchema.parse({
    search: params.busca ?? "",
    status: params.situacao,
    due: params.entrega,
    tag: params.etiqueta ?? "",
    page: params.pagina ?? 1,
    pageSize: params.porPagina,
  });
  return { ...rest, pageSize: pageSize ?? fallbackPageSize };
}

/* A busca compara sem acento e sem caixa, pelo mesmo `slugify` das rotas: nome, identificador, endereço,
   cliente, empresa e etiquetas. */
const matches = (project: Project, needle: string) =>
  [project.name, project.reference, project.url ? siteLabel(project.url) : "", project.client.name, project.client.company ?? "", ...project.tags].some(
    (field) => slugify(field, 120).includes(needle),
  );

const isOpen = (project: Project) => project.status === "active" || project.status === "paused";

/* Só projeto aberto tem entrega correndo: concluído e cancelado ficam de fora de qualquer janela. O que já
   venceu conta como dentro de qualquer janela, como no prazo das tarefas, porque é o mais urgente que existe. */
const withinDue = (project: Project, due: ProjectsDueFilter) => {
  if (due === "qualquer") return true;
  if (!project.dueAt || !isOpen(project)) return false;
  const days = differenceInCalendarDays(parseISO(project.dueAt), new Date());
  if (due === "atrasados") return days < 0;
  return days <= Number(due);
};

/**
 * Filtra, ordena e corta. A ordem é do mais novo para o mais antigo, pelo começo: é a que a pessoa espera numa
 * lista do que está em andamento. As etiquetas e as contagens por situação saem da base inteira, e não da
 * página, senão o menu de filtros só ofereceria o que já está na tela.
 */
export function listProjects(projects: Project[], query: ProjectsQuery): ProjectsListPage {
  const needle = slugify(query.search, 80);

  const filtered = projects
    .filter((project) => (query.status === "todos" ? true : project.status === query.status))
    .filter((project) => withinDue(project, query.due))
    .filter((project) => (query.tag ? project.tags.includes(query.tag) : true))
    .filter((project) => (needle ? matches(project, needle) : true))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const start = (query.page - 1) * query.pageSize;
  const tags = [...new Set(projects.flatMap((project) => project.tags))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const counts: Record<ProjectStatus, number> = { active: 0, paused: 0, done: 0, cancelled: 0 };
  for (const project of projects) counts[project.status] += 1;

  return { items: filtered.slice(start, start + query.pageSize), total: filtered.length, tags, counts };
}
