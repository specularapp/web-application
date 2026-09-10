import { differenceInCalendarDays, parseISO } from "date-fns";
import { z } from "zod";
import { slugify } from "@/lib/utils/slug";
import {
  MAX_PER_PAGE,
  QUOTES_PER_PAGE,
  defaultQuery,
  periodValues,
  statusFilterValues,
  type QuotesListPage,
  type QuotesQuery,
} from "./list-options";
import type { Quote, QuoteStatus } from "./summary";

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

/* A busca compara sem acento e sem caixa: número, título, cliente e empresa. */
const matches = (quote: Quote, needle: string) =>
  [quote.number, quote.title, quote.client.name, quote.client.company ?? ""].some((field) => slugify(field, 120).includes(needle));

const withinPeriod = (quote: Quote, period: QuotesQuery["period"]) => {
  if (period === "sempre") return true;
  return differenceInCalendarDays(new Date(), parseISO(quote.issuedAt)) <= Number(period);
};

/**
 * Filtra, ordena e corta. A ordem é do mais novo para o mais antigo, pela emissão: é a que a pessoa espera
 * numa lista do que está em andamento. As contagens por situação saem da base inteira, para o menu de
 * filtros dizer quanto há em cada uma.
 */
export function listQuotes(quotes: Quote[], query: QuotesQuery): QuotesListPage {
  const needle = slugify(query.search, 80);

  const filtered = quotes
    .filter((quote) => (query.status === "todos" ? true : quote.status === query.status))
    .filter((quote) => withinPeriod(quote, query.period))
    .filter((quote) => (needle ? matches(quote, needle) : true))
    .sort((a, b) => (a.issuedAt === b.issuedAt ? b.number.localeCompare(a.number) : b.issuedAt.localeCompare(a.issuedAt)));

  const counts: Record<QuoteStatus, number> = { draft: 0, sent: 0, viewed: 0, approved: 0, declined: 0, expired: 0 };
  for (const quote of quotes) counts[quote.status] += 1;

  const start = (query.page - 1) * query.pageSize;
  return { items: filtered.slice(start, start + query.pageSize), total: filtered.length, counts };
}

/** O orçamento que um link público aponta: só por token válido, e nunca por id, que é interno. */
export function findQuoteByToken(quotes: Quote[], token: string | undefined) {
  const parsed = shareTokenSchema.safeParse(token);
  if (!parsed.success) return null;
  return quotes.find((quote) => quote.shareToken === parsed.data) ?? null;
}
