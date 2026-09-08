import { notFound } from "next/navigation";
import { AppFrame } from "@/components/layout/app-shell";
import { Sidebar } from "@/components/layout/sidebar";
import { previewSidebar } from "@/components/layout/sidebar/preview";
import { ClientsScreen } from "@/features/clients/components/clients-screen";
import { listClients, parseClientsQuery } from "@/features/clients/list";
import { previewClientsList } from "@/features/clients/list-preview";
import { isHomologation } from "@/lib/env";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Prévia dos clientes",
  description: "Prévia de front da listagem de clientes, com o menu e a base de exemplo",
  path: "/previa/clientes",
  noIndex: true,
});

// A listagem de clientes na moldura de verdade, sem sessão e sem banco, para ajuste visual. Os filtros
// continuam na URL, então a prévia exercita a tela inteira: busca, ordem, favorito, período e página.
export default async function ClientsPreviewPage({ searchParams }: PageProps<"/previa/clientes">) {
  if (!isHomologation()) notFound();

  const params = await searchParams;
  const query = parseClientsQuery({
    busca: first(params.busca),
    ordem: first(params.ordem),
    favorito: first(params.favorito),
    periodo: first(params.periodo),
    pagina: first(params.pagina),
  });

  return (
    <AppFrame sidebar={<Sidebar {...previewSidebar} />}>
      <ClientsScreen page={listClients(previewClientsList, query)} query={query} />
    </AppFrame>
  );
}
