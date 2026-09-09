import { z } from "zod";
import { slugify } from "@/lib/utils/slug";
import {
  CATALOG_PER_PAGE,
  GRID_PER_PAGE_DEFAULT,
  MAX_PER_PAGE,
  defaultQuery,
  kindValues,
  statusValues,
  type CatalogListPage,
  type CatalogQuery,
} from "./list-options";
import type { CatalogItem } from "./summary";
import { catalogViewValues, DEFAULT_VIEW, type CatalogView } from "./view-cookie";

/* O nome do cookie da visão e a escrita dele moram em `view-cookie.ts`, que não carrega zod. Seguem saindo
   daqui para quem lê a listagem no servidor. */
export { CATALOG_GRID_COOKIE, CATALOG_VIEW_COOKIE, type CatalogView } from "./view-cookie";

/**
 * A regra da listagem do catálogo: ler o que a URL pede, filtrar, ordenar e cortar a página. Roda no
 * servidor, porque parâmetro de URL é entrada de usuário e a lista virá do banco. Recebe os itens de fora
 * e não sabe de onde vêm, então trocar a prévia pela consulta não mexe em nada daqui.
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

/* A busca compara sem acento e sem caixa, pelo mesmo `slugify` das rotas: "aplicacao" acha "Aplicação".
   O limite sobe porque a descrição é longa e o padrão de 40 letras, feito para endereço, cortaria o fim. */
const matches = (item: CatalogItem, needle: string) =>
  [item.name, item.description, item.category, item.reference].some((field) => slugify(field, 400).includes(needle));

/**
 * Filtra, ordena e corta. A ordem é sempre por nome: como na base de clientes, ninguém trocava e a opção
 * só enchia o menu. As categorias saem da base inteira, e não da página, senão o menu de filtros só
 * ofereceria o que já está na tela.
 */
export function listCatalog(items: CatalogItem[], query: CatalogQuery): CatalogListPage {
  const needle = slugify(query.search, 80);

  const filtered = items
    .filter((item) => (query.kind === "todos" ? true : query.kind === "produtos" ? item.kind === "product" : item.kind === "service"))
    .filter((item) => (query.category ? item.category === query.category : true))
    .filter((item) => (query.status === "todos" ? true : query.status === "ativos" ? item.active : !item.active))
    .filter((item) => (needle ? matches(item, needle) : true))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const start = (query.page - 1) * query.pageSize;
  const categories = [...new Set(items.map((item) => item.category))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return { items: filtered.slice(start, start + query.pageSize), total: filtered.length, categories };
}
