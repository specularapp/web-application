import { notFound } from "next/navigation";
import { getAiUsageData } from "@/features/ai/queries";
import { ProjectEditorScreen } from "@/features/projects/components/project-editor-screen";
import { getProjectById, loadProjectEditorData } from "@/features/projects/queries";
import { createMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }: PageProps<"/projetos/[id]/editar">) {
  const { id } = await params;
  const project = await getProjectById(id);

  return createMetadata({
    title: project ? `Editar ${project.name}` : "Editar projeto",
    description: "Edição da ficha do projeto, com a prévia do cartão",
    path: `/projetos/${id}/editar`,
    noIndex: true,
  });
}

/**
 * O editor de um projeto, em tela inteira: ele tem endereço próprio, então dá para mandar o link para a
 * equipe e abrir direto. Projeto inexistente cai em 404. Salvar leva à ficha dele.
 */
export default async function EditProjectPage({ params }: PageProps<"/projetos/[id]/editar">) {
  const { id } = await params;

  const [project, data, ai] = await Promise.all([getProjectById(id), loadProjectEditorData(`/projetos/${id}/editar`), getAiUsageData()]);
  if (!project) notFound();

  return <ProjectEditorScreen project={project} clients={data.clients} owners={data.owners} ai={ai} />;
}
