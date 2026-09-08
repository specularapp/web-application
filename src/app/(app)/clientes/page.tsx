import { ClientsScreen } from "@/features/clients/components/clients-screen";
import { listClients, parseClientsQuery } from "@/features/clients/list";
import { previewClientsList } from "@/features/clients/list-preview";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Clientes",
  description: "Gestão de clientes e histórico de relacionamento",
  path: "/clientes",
});

export default async function ClientsPage({ searchParams }: PageProps<"/clientes">) {
  const params = await searchParams;
  const query = parseClientsQuery({
    busca: first(params.busca),
    ordem: first(params.ordem),
    favorito: first(params.favorito),
    periodo: first(params.periodo),
    pagina: first(params.pagina),
  });

  // A lista vem de `list-preview` enquanto o domínio não existe no banco: quando a tabela nascer, muda
  // só esta linha, porque quem filtra, ordena e corta a página é `listClients`, que recebe a lista de
  // fora e não sabe de onde ela veio.
  const page = listClients(previewClientsList, query);

  return <ClientsScreen page={page} query={query} />;
}
