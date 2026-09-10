import { notFound } from "next/navigation";
import { previewAiUsage } from "@/features/ai/preview";
import { QuotesScreen } from "@/features/quotes/components/quotes-screen";
import { listQuotes, parseQuotesQuery } from "@/features/quotes/list";
import { loadQuotesScreenData } from "@/features/quotes/queries";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Orçamento",
  description: "Edição e acompanhamento de um orçamento",
  noIndex: true,
});

// A mesma tela da lista, com o editor já aberto no orçamento do endereço: assim ele pode ser compartilhado
// com a equipe e aberto direto, e pela lista abrir só troca a URL. Orçamento inexistente cai em 404.
export default async function QuotePage({ params, searchParams }: PageProps<"/orcamentos/[id]">) {
  const [{ id }, search, data] = await Promise.all([params, searchParams, loadQuotesScreenData()]);
  const quote = data.quotes.find((entry) => entry.id === id);
  if (!quote) notFound();

  const query = parseQuotesQuery({
    busca: first(search.busca),
    situacao: first(search.situacao),
    periodo: first(search.periodo),
    pagina: first(search.pagina),
    porPagina: first(search.porPagina),
  });

  return (
    <QuotesScreen
      page={listQuotes(data.quotes, query)}
      query={query}
      ai={previewAiUsage}
      editing={quote}
      clients={data.clients}
      catalog={data.catalog}
      issuer={data.issuer}
      owner={data.owner}
      nextNumber={data.nextNumber}
    />
  );
}
