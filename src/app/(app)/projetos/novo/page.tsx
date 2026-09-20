import { getAiUsageData } from "@/features/ai/queries";
import { ProjectEditorScreen } from "@/features/projects/components/project-editor-screen";
import { loadProjectEditorData } from "@/features/projects/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Novo projeto",
  description: "Cadastro de um projeto, com cliente, ferramentas, prazo e valor",
  path: "/projetos/novo",
  noIndex: true,
});

/**
 * O editor de um projeto novo, em tela inteira (2026-09-17, a pedido, na moldura do editor de contrato e do de
 * orçamento). Era a lista com a gaveta aberta por cima; montar um projeto é trabalho de tela, e a lista atrás
 * só disputava altura. A prévia ao lado mostra o cartão como vai ficar.
 */
export default async function NewProjectPage() {
  const [data, ai] = await Promise.all([loadProjectEditorData("/projetos/novo"), getAiUsageData()]);

  return <ProjectEditorScreen clients={data.clients} owners={data.owners} ai={ai} />;
}
