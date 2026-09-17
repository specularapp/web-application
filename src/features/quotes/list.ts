import { z } from "zod";
import {
  GRID_PER_PAGE_DEFAULT,
  MAX_PER_PAGE,
  QUOTES_PER_PAGE,
  defaultQuery,
  periodValues,
  statusFilterValues,
  type QuotesQuery,
} from "./list-options";
import { DEFAULT_VIEW, quotesViewValues, type QuotesView } from "./view-cookie";

/* O nome dos cookies da visão e do tamanho da grade e a escrita deles moram em `view-cookie.ts`, que não
   carrega zod. Seguem saindo daqui para quem lê a listagem no servidor. */
export { QUOTES_GRID_COOKIE, QUOTES_VIEW_COOKIE, type QuotesView } from "./view-cookie";

/**
 * A regra da listagem de orçamentos: ler o que a URL pede, filtrar, ordenar e cortar a página. Roda no
 * servidor, porque parâmetro de URL é entrada de usuário e a lista virá do banco. Recebe os orçamentos de
 * fora e não sabe de onde vêm, então trocar a prévia pela consulta não mexe em nada daqui.
 */

const querySchema = z.object({
  search: z.string().trim().max(80).catch(""),
  status: z.enum(statusFilterValues).catch(defaultQuery.status),
  period: z.enum(periodValues).catch(defaultQuery.period),
  page: z.coerce.number().int().min(1).max(9999).catch(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PER_PAGE).optional().catch(undefined),
});

/** Lê o cookie da visão com zod, porque cookie é entrada de usuário: valor estranho cai na tabela. */
export function parseQuotesView(raw: string | undefined): QuotesView {
  return z.enum(quotesViewValues).catch(DEFAULT_VIEW).parse(raw);
}

/** Lê o cookie do tamanho da grade: só um par entre 2 e o máximo vale; o resto cai no padrão. */
export function parseQuotesGridSize(raw: string | undefined) {
  return z.coerce.number().int().min(2).max(MAX_PER_PAGE).multipleOf(2).catch(GRID_PER_PAGE_DEFAULT).parse(raw);
}

/** Quantos por página quando a URL não diz: 30 na tabela, e na grade o que o cookie guardou. */
export function defaultPageSize(view: QuotesView, gridSize: number) {
  return view === "tabela" ? QUOTES_PER_PAGE : gridSize;
}

export function parseQuotesQuery(params: Record<string, string | undefined>, fallbackPageSize = QUOTES_PER_PAGE): QuotesQuery {
  const { pageSize, ...rest } = querySchema.parse({
    search: params.busca ?? "",
    status: params.situacao,
    period: params.periodo,
    page: params.pagina ?? 1,
    pageSize: params.porPagina,
  });
  return { ...rest, pageSize: pageSize ?? fallbackPageSize };
}

/** O token do link público: 32 bytes em hexadecimal, como o do convite. */
export const shareTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);
