import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getAiUsageData } from "@/features/ai/queries";
import { QuotesScreen } from "@/features/quotes/components/quotes-screen";
import { getQuoteById } from "@/features/quotes/detail";
import { QUOTES_VIEW_COOKIE, defaultPageSize, parseQuotesQuery, parseQuotesView } from "@/features/quotes/list";
import { loadQuotesScreenData } from "@/features/quotes/queries";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export async function generateMetadata({ params }: PageProps<"/orcamentos/[id]">) {
  const { id } = await params;
  const quote = await getQuoteById(id);

  return createMetadata({
    title: quote ? `Orçamento ${quote.number}` : "Orçamento",
    description: "Editor do orçamento, com os itens, o pagamento e a prévia do documento",
    path: `/orcamentos/${id}`,
    noIndex: true,
  });
}

/**
 * Um orçamento aberto é a lista com a janela do editor aberta nele (2026-10-26, a pedido: "para abrir e editar
 * precisa abrir como modal, igual a parte de criar novo"), na receita de `/clientes/[id]`: o endereço segue
 * próprio, para mandar o link para a equipe e abrir direto, e a lista atrás continua a mesma. Orçamento
 * inexistente cai em 404.
 */
export default async function QuotePage({ params, searchParams }: PageProps<"/orcamentos/[id]">) {
  const [{ id }, search, cookieStore] = await Promise.all([params, searchParams, cookies()]);
  const view = parseQuotesView(cookieStore.get(QUOTES_VIEW_COOKIE)?.value);
  const query = parseQuotesQuery(
    {
      busca: first(search.busca),
      situacao: first(search.situacao),
      periodo: first(search.periodo),
      pagina: first(search.pagina),
      porPagina: first(search.porPagina),
    },
    defaultPageSize(view),
  );

  const [quote, data, ai] = await Promise.all([getQuoteById(id), loadQuotesScreenData(query, `/orcamentos/${id}`), getAiUsageData()]);
  if (!quote) notFound();

  return (
    <QuotesScreen
      page={data.page}
      query={query}
      ai={ai}
      view={view}
      editor={{ clients: data.clients, catalog: data.catalog, issuer: data.issuer, owner: data.owner, nextNumber: data.nextNumber }}
      editing={quote}
    />
  );
}
