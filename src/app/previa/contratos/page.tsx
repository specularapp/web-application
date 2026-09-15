import { notFound } from "next/navigation";
import { AppFrame } from "@/components/layout/app-shell";
import { Sidebar } from "@/components/layout/sidebar";
import { previewSidebar } from "@/components/layout/sidebar/preview";
import { previewAiUsage } from "@/features/ai/preview";
import { ContractEditorScreen } from "@/features/contracts/components/contract-editor-screen";
import { ContractsScreen } from "@/features/contracts/components/contracts-screen";
import { listContracts, parseContractsQuery } from "@/features/contracts/list";
import { findContract, readContractLookups, readContracts } from "@/features/contracts/store";
import { hasAi, isHomologation } from "@/lib/env";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Prévia dos contratos",
  description: "Prévia de front da lista de contratos, com o menu e os contratos de exemplo",
  path: "/previa/contratos",
  noIndex: true,
});

/**
 * A lista de contratos em tela cheia sobre a `AppFrame`, a moldura do `AppShell` sem o banco, como as prévias
 * do quadro de tarefas e dos projetos: é onde a tela é conferida enquanto está sendo feita, sem precisar de
 * sessão. Só em homologação; em produção a rota não existe. `?novo=1` abre a janela de criar, `?contrato=<id>`
 * abre a janela do contrato e `?editar=<id>` mostra o editor dele. O topo da aplicação não aparece nesta
 * rota, e isso é da prévia e não da tela: o `Topbar` tira o nome da página de `navLocation`, que só conhece
 * as rotas do menu.
 */
export default async function ContractsPreviewPage({ searchParams }: PageProps<"/previa/contratos">) {
  if (!isHomologation()) notFound();

  const params = await searchParams;
  const editingId = first(params.editar);
  if (editingId) {
    const contract = await findContract(editingId);
    if (!contract) notFound();
    return (
      <AppFrame ai={{ usage: previewAiUsage, viewer: previewSidebar.user.name }} sidebar={<Sidebar {...previewSidebar} />}>
        <ContractEditorScreen contract={contract} lookups={await readContractLookups()} ai={previewAiUsage} aiAvailable={hasAi()} />
      </AppFrame>
    );
  }

  const query = parseContractsQuery({
    busca: first(params.busca),
    situacao: first(params.situacao),
    origem: first(params.origem),
    tipo: first(params.tipo),
    pagina: first(params.pagina),
    porPagina: first(params.porPagina),
  });
  const viewingId = first(params.contrato);
  const viewing = viewingId ? await findContract(viewingId) : null;

  return (
    <AppFrame ai={{ usage: previewAiUsage, viewer: previewSidebar.user.name }} sidebar={<Sidebar {...previewSidebar} />}>
      <ContractsScreen page={listContracts(await readContracts(), query)} query={query} ai={previewAiUsage} viewing={viewing} creating={Boolean(first(params.novo))} />
    </AppFrame>
  );
}
