import { cookies } from "next/headers";
import { previewAiUsage } from "@/features/ai/preview";
import { ProjectsScreen } from "@/features/projects/components/projects-screen";
import { PROJECTS_GRID_COOKIE, listProjects, parseProjectsGridSize, parseProjectsQuery } from "@/features/projects/list";
import { readProjectClients, readProjectOwners, readProjects } from "@/features/projects/store";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Novo projeto",
  description: "Cadastro de um projeto, com cliente, ferramentas, prazo e valor",
  path: "/projetos/novo",
  noIndex: true,
});

// A mesma tela da lista, com a gaveta de criar já aberta: a ficha tem endereço próprio, e abrir pela lista
// só troca a URL, sem sair da tela. Mesmo contrato de `/clientes/novo` e `/catalogo/novo`.
export default async function NewProjectPage({ searchParams }: PageProps<"/projetos/novo">) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const gridSize = parseProjectsGridSize(cookieStore.get(PROJECTS_GRID_COOKIE)?.value);
  const query = parseProjectsQuery(
    {
      busca: first(params.busca),
      situacao: first(params.situacao),
      entrega: first(params.entrega),
      etiqueta: first(params.etiqueta),
      pagina: first(params.pagina),
      porPagina: first(params.porPagina),
    },
    gridSize,
  );

  return <ProjectsScreen page={listProjects(readProjects(), query)} query={query} ai={previewAiUsage} editing="new" clients={readProjectClients()} owners={readProjectOwners()} />;
}
