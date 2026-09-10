import { previewAiUsage } from "@/features/ai/preview";
import { QuotesScreen } from "@/features/quotes/components/quotes-screen";
import { listQuotes, parseQuotesQuery } from "@/features/quotes/list";
import { loadQuotesScreenData } from "@/features/quotes/queries";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Orçamentos",
  description: "Crie, envie e acompanhe os orçamentos dos seus clientes",
  path: "/orcamentos",
});

// A lista de orçamentos, que também é onde se cria e edita: orçar e acompanhar são a mesma tela
// (2026-09-09). O filtro vem da URL e quem filtra, ordena e corta a página é `listQuotes`, que recebe a lista
// de fora; a lista, a equipe emissora e o próximo número vêm de `loadQuotesScreenData`.
export default async function QuotesPage({ searchParams }: PageProps<"/orcamentos">) {
  const [params, data] = await Promise.all([searchParams, loadQuotesScreenData()]);
  const query = parseQuotesQuery({
    busca: first(params.busca),
    situacao: first(params.situacao),
    periodo: first(params.periodo),
    pagina: first(params.pagina),
    porPagina: first(params.porPagina),
  });

  return (
    <QuotesScreen
      page={listQuotes(data.quotes, query)}
      query={query}
      ai={previewAiUsage}
      clients={data.clients}
      catalog={data.catalog}
      issuer={data.issuer}
      owner={data.owner}
      nextNumber={data.nextNumber}
    />
  );
}
