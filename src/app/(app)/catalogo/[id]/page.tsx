import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { previewAiUsage } from "@/features/ai/preview";
import { CatalogScreen } from "@/features/catalog/components/catalog-screen";
import {
  CATALOG_GRID_COOKIE,
  CATALOG_VIEW_COOKIE,
  defaultPageSize,
  listCatalog,
  parseCatalogGridSize,
  parseCatalogQuery,
  parseCatalogView,
} from "@/features/catalog/list";
import { previewCatalog } from "@/features/catalog/list-preview";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Editar item",
  description: "Edição da ficha de um produto ou serviço do catálogo",
  noIndex: true,
});

// A mesma tela do catálogo, com a gaveta de editar já aberta no item do endereço: assim a ficha pode ser
// compartilhada e aberta direto, e pela lista abrir só troca a URL, sem sair da tela.
export default async function CatalogItemPage({ params, searchParams }: PageProps<"/catalogo/[id]">) {
  const [{ id }, search, cookieStore] = await Promise.all([params, searchParams, cookies()]);
  // O item vem da prévia enquanto o domínio não existe no banco: quando a tabela nascer, muda só esta
  // linha, no mesmo contrato da listagem.
  const item = previewCatalog.find((entry) => entry.id === id);
  if (!item) notFound();

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

  return <CatalogScreen page={listCatalog(previewCatalog, query)} query={query} ai={previewAiUsage} view={view} editing={item} />;
}
