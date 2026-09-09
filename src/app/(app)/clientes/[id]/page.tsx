import { notFound } from "next/navigation";
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
import { previewClients, previewClientsList } from "@/features/clients/list-preview";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Editar cliente",
  description: "Edição da ficha de um cliente da base",
  noIndex: true,
});

// A mesma tela da base, com a janela da ficha já aberta no cliente do endereço: assim a ficha pode ser
// compartilhada e aberta direto, e pela lista abrir só troca a URL, sem sair da tela.
export default async function ClientPage({ params, searchParams }: PageProps<"/clientes/[id]">) {
  const [{ id }, search, cookieStore] = await Promise.all([params, searchParams, cookies()]);
  // A ficha vem da prévia enquanto o domínio não existe no banco: quando a tabela nascer, muda só esta
  // linha, no mesmo contrato da listagem.
  const client = previewClients.find((entry) => entry.id === id);
  if (!client) notFound();

  const view = parseClientsView(cookieStore.get(CLIENTS_VIEW_COOKIE)?.value);
  const gridSize = parseClientsGridSize(cookieStore.get(CLIENTS_GRID_COOKIE)?.value);
  const query = parseClientsQuery(
    {
      busca: first(search.busca),
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

  return <ClientsScreen page={listClients(previewClientsList, query)} query={query} ai={previewAiUsage} editing={client} view={view} />;
}
