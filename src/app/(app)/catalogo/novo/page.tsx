import { cookies } from "next/headers";
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
  title: "Novo item",
  description: "Cadastro de um produto ou serviço no catálogo",
  path: "/catalogo/novo",
  noIndex: true,
});

// A mesma tela do catálogo, com a gaveta de criar já aberta: a ficha tem endereço próprio, e abrir pela
// lista só troca a URL, sem sair da tela. Mesmo contrato de `/clientes/novo`.
export default async function NewCatalogItemPage({ searchParams }: PageProps<"/catalogo/novo">) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const view = parseCatalogView(cookieStore.get(CATALOG_VIEW_COOKIE)?.value);
  const gridSize = parseCatalogGridSize(cookieStore.get(CATALOG_GRID_COOKIE)?.value);
  const query = parseCatalogQuery(
    {
      busca: first(params.busca),
      tipo: first(params.tipo),
      categoria: first(params.categoria),
      situacao: first(params.situacao),
      pagina: first(params.pagina),
      porPagina: first(params.porPagina),
    },
    defaultPageSize(view, gridSize),
  );

  return <CatalogScreen page={listCatalog(previewCatalog, query)} query={query} ai={previewAiUsage} view={view} editing="new" />;
}
