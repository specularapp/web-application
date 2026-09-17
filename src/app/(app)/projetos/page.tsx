import { cookies } from "next/headers";
import { getAiUsageData } from "@/features/ai/queries";
import { ProjectsScreen } from "@/features/projects/components/projects-screen";
import { PROJECTS_GRID_COOKIE, parseProjectsGridSize, parseProjectsQuery } from "@/features/projects/list";
import { getProjectsScreenData } from "@/features/projects/queries";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Projetos",
  description: "Projetos executados, base do portfólio e do currículo",
  path: "/projetos",
});

export default async function ProjectsPage({ searchParams }: PageProps<"/projetos">) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  // Quantos por página, quando a URL não diz, é o que a grade mediu e guardou no cookie na última visita.
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

  const [data, ai] = await Promise.all([getProjectsScreenData(query), getAiUsageData()]);

  return <ProjectsScreen page={data.page} query={query} ai={ai} clients={data.clients} owners={data.owners} />;
}
