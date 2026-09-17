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
  title: "Novo cliente",
  description: "Cadastre um cliente na base",
  path: "/clientes/novo",
  noIndex: true,
});

// A criação é a listagem com a gaveta aberta: endereço próprio para o formulário ser compartilhável e
// recarregável, e a lista atrás continua a mesma.
export default async function NewClientPage({ searchParams }: PageProps<"/clientes/novo">) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const view = parseClientsView(cookieStore.get(CLIENTS_VIEW_COOKIE)?.value);
  const gridSize = parseClientsGridSize(cookieStore.get(CLIENTS_GRID_COOKIE)?.value);
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

  return <ClientsScreen page={page} query={query} ai={ai} editing="new" view={view} />;
}
