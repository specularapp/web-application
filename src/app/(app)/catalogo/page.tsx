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
  title: "Produtos e serviços",
  description: "Catálogo do que você vende, com preço e unidade, para usar nos orçamentos",
  path: "/catalogo",
});

export default async function CatalogPage({ searchParams }: PageProps<"/catalogo">) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const view = parseCatalogView(cookieStore.get(CATALOG_VIEW_COOKIE)?.value);
  const gridSize = parseCatalogGridSize(cookieStore.get(CATALOG_GRID_COOKIE)?.value);
  // Quantos por página, quando a URL não diz, depende da visão: 30 na tabela e, na grade, o que a prancha
  // mediu e guardou no cookie na última visita.
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

  // A lista vem de `list-preview` enquanto o domínio não existe no banco: quando a tabela nascer, muda só
  // esta linha, porque quem filtra, ordena e corta a página é `listCatalog`, que recebe a lista de fora.
  const page = listCatalog(previewCatalog, query);

  // O uso da IA vem de `features/ai/preview.ts` enquanto o domínio não existe no banco, no mesmo contrato
  // da base de clientes: o widget do topo recebe por prop e não sabe de onde vem.
  return <CatalogScreen page={page} query={query} ai={previewAiUsage} view={view} />;
}
