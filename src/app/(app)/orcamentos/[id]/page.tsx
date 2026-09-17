import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getAiUsageData } from "@/features/ai/queries";
import { QuotesScreen } from "@/features/quotes/components/quotes-screen";
import { QUOTES_GRID_COOKIE, QUOTES_VIEW_COOKIE, defaultPageSize, parseQuotesGridSize, parseQuotesQuery, parseQuotesView } from "@/features/quotes/list";
import { loadQuotesScreenData } from "@/features/quotes/queries";
import { getQuoteById } from "@/features/quotes/detail";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

/** O número do orçamento no título da aba: é ele que a página abre, e não "Orçamentos" outra vez. */
export async function generateMetadata({ params }: PageProps<"/orcamentos/[id]">) {
  const { id } = await params;
  const quote = await getQuoteById(id);

  return createMetadata({
    title: quote ? `${quote.number} ${quote.title}` : "Orçamento",
    description: "Edição e acompanhamento de um orçamento",
    path: `/orcamentos/${id}`,
    noIndex: true,
  });
}

// A mesma tela da lista, com o editor já aberto no orçamento do endereço: assim ele pode ser compartilhado
// com a equipe e aberto direto, e pela lista abrir só troca a URL. Orçamento inexistente cai em 404.
export default async function QuotePage({ params, searchParams }: PageProps<"/orcamentos/[id]">) {
  const [{ id }, search, cookieStore] = await Promise.all([params, searchParams, cookies()]);
  const view = parseQuotesView(cookieStore.get(QUOTES_VIEW_COOKIE)?.value);
  const gridSize = parseQuotesGridSize(cookieStore.get(QUOTES_GRID_COOKIE)?.value);
  const query = parseQuotesQuery(
    {
      busca: first(search.busca),
      situacao: first(search.situacao),
      periodo: first(search.periodo),
      pagina: first(search.pagina),
      porPagina: first(search.porPagina),
    },
    defaultPageSize(view, gridSize),
  );

  const [quote, data, ai] = await Promise.all([getQuoteById(id), loadQuotesScreenData(query), getAiUsageData()]);
  if (!quote) notFound();

  return (
    <QuotesScreen
      page={data.page}
      query={query}
      ai={ai}
      editing={quote}
      clients={data.clients}
      catalog={data.catalog}
      issuer={data.issuer}
      owner={data.owner}
      nextNumber={data.nextNumber}
      view={view}
    />
  );
}
