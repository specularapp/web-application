import { cookies } from "next/headers";
import { previewAiUsage } from "@/features/ai/preview";
import { ClientsScreen } from "@/features/clients/components/clients-screen";
import {
  CLIENTS_GRID_COOKIE,
  CLIENTS_VIEW_COOKIE,
  defaultPageSize,
  listClients,
  parseClientsGridSize,
  parseClientsQuery,
  parseClientsView,
} from "@/features/clients/list";
import { previewClientsList } from "@/features/clients/list-preview";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Base de clientes",
  description: "Gestão de clientes e histórico de relacionamento",
  path: "/clientes",
});

export default async function ClientsPage({ searchParams }: PageProps<"/clientes">) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const view = parseClientsView(cookieStore.get(CLIENTS_VIEW_COOKIE)?.value);
  const gridSize = parseClientsGridSize(cookieStore.get(CLIENTS_GRID_COOKIE)?.value);
  // Quantos por página, quando a URL não diz, depende da visão: 30 na tabela e, na grade, o que a prancha
  // mediu e guardou no cookie na última visita.
  const query = parseClientsQuery(
    {
      busca: first(params.busca),
      favorito: first(params.favorito),
      situacao: first(params.situacao),
      periodo: first(params.periodo),
      email: first(params.email),
      telefone: first(params.telefone),
      pagina: first(params.pagina),
      porPagina: first(params.porPagina),
    },
    defaultPageSize(view, gridSize),
  );

  // A lista vem de `list-preview` enquanto o domínio não existe no banco: quando a tabela nascer, muda
  // só esta linha, porque quem filtra, ordena e corta a página é `listClients`, que recebe a lista de
  // fora e não sabe de onde ela veio.
  const page = listClients(previewClientsList, query);

  // O uso da IA vem de `features/ai/preview.ts` enquanto o domínio não existe no banco, no mesmo
  // contrato dos blocos do painel: o widget recebe por prop e não sabe de onde vem.
  return <ClientsScreen page={page} query={query} ai={previewAiUsage} view={view} />;
}
