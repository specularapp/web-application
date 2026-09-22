import { notFound } from "next/navigation";
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
import { getClientById, getClientsPage } from "@/features/clients/queries";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

/** O nome do cliente no título da aba: é a ficha dele que a página abre. */
export async function generateMetadata({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const client = await getClientById(id);

  return createMetadata({
    title: client ? client.name : "Cliente",
    description: "Ficha do cliente, com histórico de orçamentos e projetos",
    path: `/clientes/${id}`,
    noIndex: true,
  });
}

// A mesma tela da base, com a janela da ficha já aberta no cliente do endereço: assim a ficha pode ser
// compartilhada e aberta direto, e pela lista abrir só troca a URL, sem sair da tela.
export default async function ClientPage({ params, searchParams }: PageProps<"/clientes/[id]">) {
  const [{ id }, search, cookieStore] = await Promise.all([params, searchParams, cookies()]);

  const view = parseClientsView(cookieStore.get(CLIENTS_VIEW_COOKIE)?.value);
  const gridSize = parseClientsGridSize(cookieStore.get(CLIENTS_GRID_COOKIE)?.value);
  const query = parseClientsQuery(
    {
      busca: first(search.busca),
      grupo: first(search.grupo),
      favorito: first(search.favorito),
      situacao: first(search.situacao),
      periodo: first(search.periodo),
      email: first(search.email),
      telefone: first(search.telefone),
      pagina: first(search.pagina),
      porPagina: first(search.porPagina),
    },
    defaultPageSize(view, gridSize),
  );

  const [client, page, ai] = await Promise.all([getClientById(id), getClientsPage(query), getAiUsageData()]);
  if (!client) notFound();

  return <ClientsScreen page={page} query={query} ai={ai} editing={client} view={view} />;
}
