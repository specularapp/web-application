import { z } from "zod";
import {
  CATALOG_PER_PAGE,
  GRID_PER_PAGE_DEFAULT,
  MAX_PER_PAGE,
  defaultQuery,
  kindValues,
  statusValues,
  type CatalogQuery,
} from "./list-options";
import { catalogViewValues, DEFAULT_VIEW, type CatalogView } from "./view-cookie";

/* O nome do cookie da visão e a escrita dele moram em `view-cookie.ts`, que não carrega zod. Seguem saindo
   daqui para quem lê a listagem no servidor. */
export { CATALOG_GRID_COOKIE, CATALOG_VIEW_COOKIE, type CatalogView } from "./view-cookie";

/**
 * A leitura do que a URL e os cookies pedem na listagem do catálogo. Roda no servidor, porque parâmetro de
 * URL e cookie são entrada de usuário. Filtrar, ordenar e cortar é condição de SQL em `service.ts`.
 */

/* Valor fora da lista cai no padrão em vez de derrubar a página: a URL é digitável e vem de link antigo. */
const querySchema = z.object({
  search: z.string().trim().max(80).catch(""),
  kind: z.enum(kindValues).catch(defaultQuery.kind),
  category: z.string().trim().max(60).catch(defaultQuery.category),
  status: z.enum(statusValues).catch(defaultQuery.status),
  page: z.coerce.number().int().min(1).max(9999).catch(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PER_PAGE).optional().catch(undefined),
});

/** Lê o cookie da visão com zod, porque cookie é entrada de usuário: valor estranho cai na grade. */
export function parseCatalogView(raw: string | undefined): CatalogView {
  return z.enum(catalogViewValues).catch(DEFAULT_VIEW).parse(raw);
}

/** Lê o cookie do tamanho da grade: só um par entre 2 e o máximo vale; o resto cai no padrão. */
export function parseCatalogGridSize(raw: string | undefined) {
  return z.coerce.number().int().min(2).max(MAX_PER_PAGE).multipleOf(2).catch(GRID_PER_PAGE_DEFAULT).parse(raw);
}

/** Quantos por página quando a URL não diz: 30 na tabela, e na grade o que o cookie guardou. */
export function defaultPageSize(view: CatalogView, gridSize: number) {
  return view === "tabela" ? CATALOG_PER_PAGE : gridSize;
}

export function parseCatalogQuery(params: Record<string, string | undefined>, fallbackPageSize = CATALOG_PER_PAGE): CatalogQuery {
  const { pageSize, ...rest } = querySchema.parse({
    search: params.busca ?? "",
    kind: params.tipo,
    category: params.categoria ?? "",
    status: params.situacao,
    page: params.pagina ?? 1,
    pageSize: params.porPagina,
  });
  return { ...rest, pageSize: pageSize ?? fallbackPageSize };
}
