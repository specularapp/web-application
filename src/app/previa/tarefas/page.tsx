import { notFound } from "next/navigation";
import { AppFrame } from "@/components/layout/app-shell";
import { Sidebar } from "@/components/layout/sidebar";
import { previewSidebar } from "@/components/layout/sidebar/preview";
import { previewAiUsage } from "@/features/ai/preview";
import { TasksScreen } from "@/features/tasks/components/tasks-screen";
import { buildTasksBoard, parseStageOverrides, parseTasksQuery } from "@/features/tasks/list";
import { previewRecords } from "@/features/records/preview";
import { previewTaskPeople, previewTasks } from "@/features/tasks/list-preview";
import { findProject, stagesInUse, tasksOfProject } from "@/features/tasks/tree";
import { previewTaskTree } from "@/features/tasks/tree-preview";
import { isHomologation } from "@/lib/env";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Prévia das tarefas",
  description: "Prévia de front do quadro de tarefas, com o menu e as etapas de exemplo",
  path: "/previa/tarefas",
  noIndex: true,
});

/**
 * O quadro em tela cheia sobre a `AppFrame`, a moldura do `AppShell` sem o banco, como a prévia do painel:
 * é onde a tela é conferida enquanto está sendo feita, sem precisar de sessão. Só em homologação; em
 * produção a rota não existe. As etapas recolhidas não vêm de cookie aqui, porque a prévia é para olhar.
 *
 * O topo da aplicação não aparece nesta rota, e isso é da prévia e não da tela: o `Topbar` tira o nome da
 * página de `navLocation`, que só conhece as rotas do menu, e `/previa/tarefas` não é uma delas. Em
 * `/tarefas` ele desenha "Área de trabalho / Tarefas" normalmente.
 *
 * `?projeto=<slug>` abre o quadro daquele projeto, com as etapas dele: é o que permite conferir aqui o que
 * em `/tarefas/<slug>` só se vê com sessão. Slug que não existe cai no quadro de tudo.
 */
export default async function TasksPreviewPage({ searchParams }: PageProps<"/previa/tarefas">) {
  if (!isHomologation()) notFound();

  const params = await searchParams;
  const query = parseTasksQuery({
    busca: first(params.busca),
    prioridade: first(params.prioridade),
    prazo: first(params.prazo),
    atrasadas: first(params.atrasadas),
  });

  const slug = first(params.projeto);
  const project = slug ? findProject(previewTaskTree, slug) : null;
  const tasks = project ? tasksOfProject(previewTasks, project) : previewTasks;
  const stages = project ? project.stages : stagesInUse(previewTasks);

  return (
    <AppFrame sidebar={<Sidebar {...previewSidebar} taskRoute={project?.slug} />}>
      <TasksScreen
        board={buildTasksBoard(tasks, query, stages)}
        query={query}
        collapsed={parseStageOverrides(undefined)}
        ai={previewAiUsage}
        title={project?.name}
        basePath="/previa/tarefas"
        team={previewTaskPeople}
        records={previewRecords}
      />
    </AppFrame>
  );
}
