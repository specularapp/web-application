import { notFound } from "next/navigation";
import { previewAiUsage } from "@/features/ai/preview";
import { ClientsScreen } from "@/features/clients/components/clients-screen";
import { listClients, parseClientsQuery } from "@/features/clients/list";
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
  const [{ id }, search] = await Promise.all([params, searchParams]);
  // A ficha vem da prévia enquanto o domínio não existe no banco: quando a tabela nascer, muda só esta
  // linha, no mesmo contrato da listagem.
  const client = previewClients.find((entry) => entry.id === id);
  if (!client) notFound();

  const query = parseClientsQuery({
    busca: first(search.busca),
    ordem: first(search.ordem),
    favorito: first(search.favorito),
    situacao: first(search.situacao),
    periodo: first(search.periodo),
    email: first(search.email),
    telefone: first(search.telefone),
    pagina: first(search.pagina),
  });

  return <ClientsScreen page={listClients(previewClientsList, query)} query={query} ai={previewAiUsage} editing={client} />;
}
