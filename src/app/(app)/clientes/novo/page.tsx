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
  title: "Novo cliente",
  description: "Cadastro de um novo cliente na base",
  path: "/clientes/novo",
  noIndex: true,
});

// A mesma tela da base, com a janela de criar já aberta: a ficha tem endereço próprio, e abrir pela lista
// só troca a URL, sem sair da tela.
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

  return <ClientsScreen page={listClients(previewClientsList, query)} query={query} ai={previewAiUsage} editing="new" view={view} />;
}
