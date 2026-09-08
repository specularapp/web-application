import { previewAiUsage } from "@/features/ai/preview";
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
    situacao: first(params.situacao),
    periodo: first(params.periodo),
    email: first(params.email),
    telefone: first(params.telefone),
    pagina: first(params.pagina),
  });

  // A lista vem de `list-preview` enquanto o domínio não existe no banco: quando a tabela nascer, muda
  // só esta linha, porque quem filtra, ordena e corta a página é `listClients`, que recebe a lista de
  // fora e não sabe de onde ela veio.
  const page = listClients(previewClientsList, query);

  // O uso da IA vem de `features/ai/preview.ts` enquanto o domínio não existe no banco, no mesmo
  // contrato dos blocos do painel: o widget recebe por prop e não sabe de onde vem.
  return <ClientsScreen page={page} query={query} ai={previewAiUsage} />;
}
