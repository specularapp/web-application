import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { previewAiUsage } from "@/features/ai/preview";
import { ProjectsScreen } from "@/features/projects/components/projects-screen";
import { PROJECTS_GRID_COOKIE, listProjects, parseProjectsGridSize, parseProjectsQuery } from "@/features/projects/list";
import { findProject, readProjectClients, readProjectOwners, readProjects } from "@/features/projects/store";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export async function generateMetadata({ params }: PageProps<"/projetos/[id]/editar">) {
  const { id } = await params;
  const project = findProject(id);

  return createMetadata({
    title: project ? `Editar ${project.name}` : "Editar projeto",
    description: "Edição da ficha do projeto",
    path: `/projetos/${id}/editar`,
    noIndex: true,
  });
}

// A mesma tela da lista, com a janela do projeto aberta e a gaveta de editar por cima dela: é onde a pessoa
// cai ao editar a partir da ficha, então fechar a gaveta devolve à ficha, e não à lista nua.
export default async function EditProjectPage({ params, searchParams }: PageProps<"/projetos/[id]/editar">) {
  const [{ id }, search, cookieStore] = await Promise.all([params, searchParams, cookies()]);
  const project = findProject(id);
  if (!project) notFound();

  const gridSize = parseProjectsGridSize(cookieStore.get(PROJECTS_GRID_COOKIE)?.value);
  const query = parseProjectsQuery(
    {
      busca: first(search.busca),
      situacao: first(search.situacao),
      entrega: first(search.entrega),
      etiqueta: first(search.etiqueta),
      pagina: first(search.pagina),
      porPagina: first(search.porPagina),
    },
    gridSize,
  );

  return (
    <ProjectsScreen page={listProjects(readProjects(), query)} query={query} ai={previewAiUsage} viewing={project} editing={project} clients={readProjectClients()} owners={readProjectOwners()} />
  );
}
