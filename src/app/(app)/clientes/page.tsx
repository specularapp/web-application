import { cookies } from "next/headers";
import { getAiUsageData } from "@/features/ai/queries";
import { ClientsScreen } from "@/features/clients/components/clients-screen";
import {
  CLIENTS_GRID_COOKIE,
  CLIENTS_VIEW_COOKIE,
  defaultPageSize,
  parseClientsGridSize,
  parseClientsQuery,
  parseClientsView,
} from "@/features/clients/list";
import { getClientsPage } from "@/features/clients/queries";
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

  const [page, ai] = await Promise.all([getClientsPage(query), getAiUsageData()]);

  return <ClientsScreen page={page} query={query} ai={ai} view={view} />;
}
