import { differenceInCalendarDays, parseISO } from "date-fns";
import { z } from "zod";
import { slugify } from "@/lib/utils/slug";
import {
  CLIENTS_PER_PAGE,
  defaultQuery,
  favoriteValues,
  periodValues,
  statusValues,
  type ClientListItem,
  type ClientsListPage,
  type ClientsQuery,
} from "./list-options";

/**
 * A regra da listagem de clientes: ler o que a URL pede, filtrar, ordenar e cortar a página. Roda no
 * servidor, porque parâmetro de URL é entrada de usuário e a lista virá do banco. Recebe os clientes de
 * fora e não sabe de onde vêm, então trocar a prévia pela consulta não mexe em nada daqui.
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
});

export function parseClientsQuery(params: Record<string, string | undefined>): ClientsQuery {
  return querySchema.parse({
    search: params.busca ?? "",
    favorite: params.favorito,
    status: params.situacao,
    period: params.periodo,
    withEmail: params.email,
    withPhone: params.telefone,
    page: params.pagina ?? 1,
  });
}

/* A busca compara pelo mesmo formato dos dois lados, então acento e maiúscula não atrapalham, e o
   telefone é comparado só em dígitos, porque na tela ele aparece com máscara e no banco não. */
function matches(client: ClientListItem, search: string) {
  if (!search) return true;
  const needle = slugify(search, 80);
  const digits = search.replace(/\D/g, "");

  if (slugify(client.name, 80).includes(needle)) return true;
  if (client.company && slugify(client.company, 80).includes(needle)) return true;
  if (client.email && slugify(client.email, 80).includes(needle)) return true;
  return Boolean(digits && client.phone?.includes(digits));
}

function withinPeriod(client: ClientListItem, period: ClientsQuery["period"]) {
  if (period === "sempre") return true;
  const days = differenceInCalendarDays(new Date(), parseISO(client.createdAt));
  return days <= Number(period);
}

/* A lista sai sempre por nome: a ordem deixou de ser filtro em 2026-09-08, a pedido, porque ninguém
   trocava e só enchia o menu. */
const byName = (a: ClientListItem, b: ClientListItem) => a.name.localeCompare(b.name, "pt-BR");

/**
 * Filtra, ordena e corta a página. O total devolvido é o do filtro, e não o da base, porque é ele que a
 * paginação usa para saber quantas páginas existem. Página além do fim devolve lista vazia, e a barra
 * de paginação leva de volta.
 */
export function listClients(clients: ClientListItem[], query: ClientsQuery): ClientsListPage {
  const filtered = clients.filter(
    (client) =>
      matches(client, query.search) &&
      withinPeriod(client, query.period) &&
      (query.favorite === "todos" || (query.favorite === "favoritos" ? client.favorite : !client.favorite)) &&
      (query.status === "todos" || (query.status === "ativos" ? client.active : !client.active)) &&
      (!query.withEmail || Boolean(client.email)) &&
      (!query.withPhone || Boolean(client.phone)),
  );

  const start = (query.page - 1) * CLIENTS_PER_PAGE;

  return {
    items: [...filtered].sort(byName).slice(start, start + CLIENTS_PER_PAGE),
    total: filtered.length,
  };
}
