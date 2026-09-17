import { z } from "zod";
import {
  CLIENTS_PER_PAGE,
  GRID_PER_PAGE_DEFAULT,
  MAX_PER_PAGE,
  defaultQuery,
  favoriteValues,
  periodValues,
  statusValues,
  type ClientsQuery,
} from "./list-options";
import { clientsViewValues, DEFAULT_VIEW, type ClientsView } from "./view-cookie";

/* O nome dos cookies da visão e do tamanho da grade e a escrita deles moram em `view-cookie.ts`, que não
   carrega zod. Seguem saindo daqui para quem lê a listagem no servidor. */
export { CLIENTS_GRID_COOKIE, CLIENTS_VIEW_COOKIE, type ClientsView } from "./view-cookie";

/**
 * A leitura do que a URL e os cookies pedem na listagem de clientes. Roda no servidor, porque parâmetro de
 * URL e cookie são entrada de usuário. Filtrar, ordenar e cortar é condição de SQL em `service.ts`: aqui só
 * se decide o que a pergunta significa.
 */

/* Valor fora da lista cai no padrão em vez de derrubar a página: a URL é digitável e vem de link antigo. */
/* Filtro de liga e desliga na URL: presente com "1" liga, qualquer outra coisa ou ausente desliga. */
const flag = z
  .string()
  .optional()
  .transform((value) => value === "1")
  .catch(false);

const querySchema = z.object({
  search: z.string().trim().max(80).catch(""),
  favorite: z.enum(favoriteValues).catch(defaultQuery.favorite),
  status: z.enum(statusValues).catch(defaultQuery.status),
  period: z.enum(periodValues).catch(defaultQuery.period),
  withEmail: flag,
  withPhone: flag,
  page: z.coerce.number().int().min(1).max(9999).catch(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PER_PAGE).optional().catch(undefined),
});

/** Lê o cookie da visão com zod, porque cookie é entrada de usuário: valor estranho cai na grade. */
export function parseClientsView(raw: string | undefined): ClientsView {
  return z.enum(clientsViewValues).catch(DEFAULT_VIEW).parse(raw);
}

/** Lê o cookie do tamanho da grade: só um par entre 2 e o máximo vale; o resto cai no padrão. */
export function parseClientsGridSize(raw: string | undefined) {
  return z.coerce.number().int().min(2).max(MAX_PER_PAGE).multipleOf(2).catch(GRID_PER_PAGE_DEFAULT).parse(raw);
}

/** Quantos por página quando a URL não diz: 30 na tabela, e na grade o que o cookie guardou. */
export function defaultPageSize(view: ClientsView, gridSize: number) {
  return view === "tabela" ? CLIENTS_PER_PAGE : gridSize;
}

export function parseClientsQuery(params: Record<string, string | undefined>, fallbackPageSize = CLIENTS_PER_PAGE): ClientsQuery {
  const { pageSize, ...rest } = querySchema.parse({
    search: params.busca ?? "",
    favorite: params.favorito,
    status: params.situacao,
    period: params.periodo,
    withEmail: params.email,
    withPhone: params.telefone,
    page: params.pagina ?? 1,
    pageSize: params.porPagina,
  });
  return { ...rest, pageSize: pageSize ?? fallbackPageSize };
}
