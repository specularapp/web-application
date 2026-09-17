import { z } from "zod";
import {
  GRID_PER_PAGE_DEFAULT,
  MAX_PER_PAGE,
  defaultQuery,
  dueFilterValues,
  statusFilterValues,
  type ProjectsQuery,
} from "./list-options";

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
