import { cookies } from "next/headers";
import { previewAiUsage } from "@/features/ai/preview";
import { QuotesScreen } from "@/features/quotes/components/quotes-screen";
import { QUOTES_GRID_COOKIE, QUOTES_VIEW_COOKIE, defaultPageSize, listQuotes, parseQuotesGridSize, parseQuotesQuery, parseQuotesView } from "@/features/quotes/list";
import { loadQuotesScreenData } from "@/features/quotes/queries";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Novo orçamento",
  description: "Monte um orçamento personalizado e envie ao cliente",
  path: "/orcamentos/novo",
  noIndex: true,
});

// A mesma tela da lista, com o editor já aberto em branco: o orçamento tem endereço próprio, e abrir pela
// lista só troca a URL, sem sair da tela. `?item=` e `?cliente=` chegam do catálogo e da base de clientes e
// entram já preenchidos.
export default async function NewQuotePage({ searchParams }: PageProps<"/orcamentos/novo">) {
  const [params, cookieStore, data] = await Promise.all([searchParams, cookies(), loadQuotesScreenData("/orcamentos/novo")]);
  const view = parseQuotesView(cookieStore.get(QUOTES_VIEW_COOKIE)?.value);
  const gridSize = parseQuotesGridSize(cookieStore.get(QUOTES_GRID_COOKIE)?.value);
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
  const prefill = { itemId: first(params.item) || undefined, clientId: first(params.cliente) || undefined };

  return (
    <QuotesScreen
      page={listQuotes(data.quotes, query)}
      query={query}
      ai={previewAiUsage}
      editing="new"
      prefill={prefill}
      clients={data.clients}
      catalog={data.catalog}
      issuer={data.issuer}
      owner={data.owner}
      nextNumber={data.nextNumber}
      view={view}
    />
  );
}
