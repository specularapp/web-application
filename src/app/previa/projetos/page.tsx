import { notFound } from "next/navigation";
import { AppFrame } from "@/components/layout/app-shell";
import { Sidebar } from "@/components/layout/sidebar";
import { previewSidebar } from "@/components/layout/sidebar/preview";
import { previewAiUsage } from "@/features/ai/preview";
import { ProjectsScreen } from "@/features/projects/components/projects-screen";
import { listProjects, parseProjectsQuery } from "@/features/projects/list";
import { findProject, readProjectClients, readProjectOwners, readProjects } from "@/features/projects/store";
import { isHomologation } from "@/lib/env";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Prévia dos projetos",
  description: "Prévia de front da lista de projetos, com o menu e os projetos de exemplo",
  path: "/previa/projetos",
  noIndex: true,
});

/**
 * A lista de projetos em tela cheia sobre a `AppFrame`, a moldura do `AppShell` sem o banco, como a prévia do
 * quadro de tarefas: é onde a tela é conferida enquanto está sendo feita, sem precisar de sessão. Só em
 * homologação; em produção a rota não existe.
 *
 * `?projeto=<id>` abre a janela daquele projeto, `?novo=1` abre a gaveta de criar e `?editar=<id>` abre a
 * gaveta de editar por cima da janela, que em `/projetos/...` só se veem com sessão. O topo da aplicação não
 * aparece nesta rota, e isso é da prévia e não da tela: o `Topbar` tira o nome da página de `navLocation`,
 * que só conhece as rotas do menu.
 */
export default async function ProjectsPreviewPage({ searchParams }: PageProps<"/previa/projetos">) {
  if (!isHomologation()) notFound();

  const params = await searchParams;
  const query = parseProjectsQuery({
    busca: first(params.busca),
    situacao: first(params.situacao),
    entrega: first(params.entrega),
    etiqueta: first(params.etiqueta),
    pagina: first(params.pagina),
    porPagina: first(params.porPagina),
  });

  const editingId = first(params.editar);
  const viewingId = first(params.projeto) ?? editingId;
  const viewing = viewingId ? findProject(viewingId) : null;
  const editing = first(params.novo) ? "new" : editingId ? findProject(editingId) : null;

  return (
    <AppFrame sidebar={<Sidebar {...previewSidebar} />}>
      <ProjectsScreen page={listProjects(readProjects(), query)} query={query} ai={previewAiUsage} viewing={viewing} editing={editing} clients={readProjectClients()} owners={readProjectOwners()} />
    </AppFrame>
  );
}
