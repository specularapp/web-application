import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getAiUsageData } from "@/features/ai/queries";
import { CatalogScreen } from "@/features/catalog/components/catalog-screen";
import {
  CATALOG_GRID_COOKIE,
  CATALOG_VIEW_COOKIE,
  defaultPageSize,
  parseCatalogGridSize,
  parseCatalogQuery,
  parseCatalogView,
} from "@/features/catalog/list";
import { getCatalogItemById, getCatalogPage } from "@/features/catalog/queries";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

/** O nome do item no título da aba: é a ficha dele que a página abre. */
export async function generateMetadata({ params }: PageProps<"/catalogo/[id]">) {
  const { id } = await params;
  const item = await getCatalogItemById(id);

  return createMetadata({
    title: item ? item.name : "Item do catálogo",
    description: "Ficha do produto ou serviço, com preço, entrega e histórico de venda",
    path: `/catalogo/${id}`,
    noIndex: true,
  });
}

// A mesma tela do catálogo, com a gaveta de editar já aberta no item do endereço: assim a ficha pode ser
// compartilhada e aberta direto, e pela lista abrir só troca a URL, sem sair da tela.
export default async function CatalogItemPage({ params, searchParams }: PageProps<"/catalogo/[id]">) {
  const [{ id }, search, cookieStore] = await Promise.all([params, searchParams, cookies()]);

  const view = parseCatalogView(cookieStore.get(CATALOG_VIEW_COOKIE)?.value);
  const gridSize = parseCatalogGridSize(cookieStore.get(CATALOG_GRID_COOKIE)?.value);
  const query = parseCatalogQuery(
    {
      busca: first(search.busca),
      tipo: first(search.tipo),
      categoria: first(search.categoria),
      situacao: first(search.situacao),
      pagina: first(search.pagina),
      porPagina: first(search.porPagina),
    },
    defaultPageSize(view, gridSize),
  );

  const [item, page, ai] = await Promise.all([getCatalogItemById(id), getCatalogPage(query), getAiUsageData()]);
  if (!item) notFound();

  return <CatalogScreen page={page} query={query} ai={ai} view={view} editing={item} />;
}
