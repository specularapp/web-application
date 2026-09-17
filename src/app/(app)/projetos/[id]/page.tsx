import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getAiUsageData } from "@/features/ai/queries";
import { ProjectsScreen } from "@/features/projects/components/projects-screen";
import { PROJECTS_GRID_COOKIE, parseProjectsGridSize, parseProjectsQuery } from "@/features/projects/list";
import { getProjectById, getProjectsScreenData } from "@/features/projects/queries";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

/** O nome do projeto no título da aba: é a ficha dele que a página abre, e não "Projetos" outra vez. */
export async function generateMetadata({ params }: PageProps<"/projetos/[id]">) {
  const { id } = await params;
  const project = await getProjectById(id);

  return createMetadata({
    title: project ? project.name : "Projeto",
    description: "Ficha do projeto, com equipe, tarefas, orçamentos e atividade",
    path: `/projetos/${id}`,
    noIndex: true,
  });
}

// A mesma tela da lista, com a janela do projeto já aberta no do endereço: assim a ficha pode ser
// compartilhada e aberta direto, e pela lista abrir só troca a URL, sem sair da tela.
export default async function ProjectPage({ params, searchParams }: PageProps<"/projetos/[id]">) {
  const [{ id }, search, cookieStore] = await Promise.all([params, searchParams, cookies()]);

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

  const [project, data, ai] = await Promise.all([getProjectById(id), getProjectsScreenData(query), getAiUsageData()]);
  if (!project) notFound();

  return <ProjectsScreen page={data.page} query={query} ai={ai} viewing={project} clients={data.clients} owners={data.owners} />;
}
