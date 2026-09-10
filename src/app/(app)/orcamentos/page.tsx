import { cookies } from "next/headers";
import { previewAiUsage } from "@/features/ai/preview";
import { QuotesScreen } from "@/features/quotes/components/quotes-screen";
import { QUOTES_GRID_COOKIE, QUOTES_VIEW_COOKIE, defaultPageSize, listQuotes, parseQuotesGridSize, parseQuotesQuery, parseQuotesView } from "@/features/quotes/list";
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
  const [params, cookieStore, data] = await Promise.all([searchParams, cookies(), loadQuotesScreenData()]);
  const view = parseQuotesView(cookieStore.get(QUOTES_VIEW_COOKIE)?.value);
  const gridSize = parseQuotesGridSize(cookieStore.get(QUOTES_GRID_COOKIE)?.value);
  // Quantos por página, quando a URL não diz, depende da visão: 30 na tabela e, na grade, o que a prancha
  // mediu e guardou no cookie na última visita.
  const query = parseQuotesQuery(
    {
      busca: first(params.busca),
      situacao: first(params.situacao),
      periodo: first(params.periodo),
      pagina: first(params.pagina),
      porPagina: first(params.porPagina),
    },
    defaultPageSize(view, gridSize),
  );

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
      view={view}
    />
  );
}
