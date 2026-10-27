import { z } from "zod";
import { first } from "@/lib/utils/search-params";
import { slugify } from "@/lib/utils/slug";
import {
  CONTRACTS_PER_PAGE,
  FUNNEL_PER_PAGE,
  MAX_PER_PAGE,
  defaultQuery,
  kindFilterValues,
  sourceFilterValues,
  statusFilterValues,
  type ContractsListPage,
  type ContractsQuery,
} from "./list-options";
import type { Contract, ContractStatus } from "./summary";
import { CONTRACTS_VIEW_COOKIE, DEFAULT_CONTRACTS_VIEW, contractsViewValues, type ContractsView } from "./view-cookie";

/* O nome do cookie da visão e a escrita dele moram em `view-cookie.ts`, que não carrega zod. Segue saindo
   daqui para quem lê a listagem no servidor. */
export { CONTRACTS_VIEW_COOKIE };

/**
 * A regra da listagem de contratos: ler o que a URL pede, filtrar, ordenar e cortar a página. Roda no
 * servidor, porque parâmetro de URL é entrada de usuário e a lista virá do banco. Recebe os contratos de fora
 * e não sabe de onde vêm, então trocar a prévia pela consulta não mexe em nada daqui.
 */

/* Valor fora da lista cai no padrão em vez de derrubar a página: a URL é digitável e vem de link antigo. */
const querySchema = z.object({
  search: z.string().trim().max(80).catch(""),
  status: z.enum(statusFilterValues).catch(defaultQuery.status),
  source: z.enum(sourceFilterValues).catch(defaultQuery.source),
  kind: z.enum(kindFilterValues).catch(defaultQuery.kind),
  page: z.coerce.number().int().min(1).max(9999).catch(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PER_PAGE).optional().catch(undefined),
});

/** Lê o cookie da visão: fora da lista cai no funil. */
export function parseContractsView(raw: string | undefined): ContractsView {
  return z.enum(contractsViewValues).catch(DEFAULT_CONTRACTS_VIEW).parse(raw);
}

/** A medida da página de cada visão, quando a URL não diz outra. */
export const defaultContractsPageSize = (view: ContractsView) => (view === "tabela" ? CONTRACTS_PER_PAGE : FUNNEL_PER_PAGE);

export function parseContractsQuery(params: Record<string, string | undefined>, fallbackPageSize = FUNNEL_PER_PAGE): ContractsQuery {
  const { pageSize, ...rest } = querySchema.parse({
    search: params.busca ?? "",
    status: params.situacao,
    source: params.origem,
    kind: params.tipo,
    page: params.pagina ?? 1,
    pageSize: params.porPagina,
  });
  return { ...rest, pageSize: pageSize ?? fallbackPageSize };
}

/* A busca compara sem acento e sem caixa, pelo mesmo `slugify` das rotas: título, identificador, cliente,
   empresa, projeto e número do orçamento. */
const matches = (contract: Contract, needle: string) =>
  [contract.title, contract.reference, contract.client?.name ?? "", contract.client?.company ?? "", contract.project?.name ?? "", contract.quote?.number ?? ""].some((field) =>
    slugify(field, 120).includes(needle),
  );

/**
 * Filtra, ordena e corta. A ordem é do mais novo para o mais antigo, pela criação: é a que a pessoa espera
 * numa lista de documentos. As contagens por situação saem da base inteira, e não da página, senão o menu de
 * filtros só diria o que já está na tela.
 */
export function listContracts(contracts: Contract[], query: ContractsQuery): ContractsListPage {
  const needle = slugify(query.search, 80);

  const filtered = contracts
    .filter((contract) => (query.status === "todos" ? true : contract.status === query.status))
    .filter((contract) => (query.source === "todas" ? true : contract.source === query.source))
    .filter((contract) => (query.kind === "todos" ? true : contract.kind === query.kind))
    .filter((contract) => (needle ? matches(contract, needle) : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const start = (query.page - 1) * query.pageSize;
  const counts: Record<ContractStatus, number> = { draft: 0, sent: 0, partial: 0, signed: 0, cancelled: 0 };
  for (const contract of contracts) counts[contract.status] += 1;

  return { items: filtered.slice(start, start + query.pageSize), total: filtered.length, counts };
}

/** O que as páginas de contratos leem da URL, na mesma conta nas quatro (lista, novo, ficha e editor). */
export function contractsQueryFrom(search: Record<string, string | string[] | undefined>, view: ContractsView): ContractsQuery {
  return parseContractsQuery(
    {
      busca: first(search.busca),
      situacao: first(search.situacao),
      origem: first(search.origem),
      tipo: first(search.tipo),
      pagina: first(search.pagina),
      porPagina: first(search.porPagina),
    },
    defaultContractsPageSize(view),
  );
}
