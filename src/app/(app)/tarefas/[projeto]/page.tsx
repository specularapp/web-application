import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { previewAiUsage } from "@/features/ai/preview";
import { TasksScreen } from "@/features/tasks/components/tasks-screen";
import { TASKS_STAGES_COOKIE, buildTasksBoard, parseStageOverrides, parseTasksQuery } from "@/features/tasks/list";
import { previewRecords } from "@/features/records/preview";
import { previewTaskPeople, previewTasks } from "@/features/tasks/list-preview";
import { findProject, tasksOfProject } from "@/features/tasks/tree";
import { previewTaskTree } from "@/features/tasks/tree-preview";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

/** O nome do projeto no título da aba: é o quadro dele que a página abre, e não "Tarefas" outra vez. */
export async function generateMetadata({ params }: PageProps<"/tarefas/[projeto]">) {
  const { projeto } = await params;
  const project = findProject(previewTaskTree, projeto);

  return createMetadata({
    title: project ? project.name : "Projeto",
    description: "Quadro de tarefas do projeto, com as etapas do fluxo dele",
    path: `/tarefas/${projeto}`,
    noIndex: true,
  });
}

// O quadro de um projeto: a mesma tela de todas as tarefas, com três diferenças que vêm da arquitetura
// (2026-09-10) — só as tarefas dele, **as etapas que ele declara**, e o nome dele no topo. As etapas são do
// projeto de propósito: o fluxo do site institucional tem Publicação e o do Estúdio Bravo tem Bloqueada, e é
// isso que faz o quadro ser dele e não um recorte do quadro geral.
export default async function TaskProjectPage({ params, searchParams }: PageProps<"/tarefas/[projeto]">) {
  const [{ projeto }, search, cookieStore] = await Promise.all([params, searchParams, cookies()]);

  // A árvore vem da prévia enquanto pastas e projetos não existem no banco: quando a tabela nascer, muda só
  // esta linha, no mesmo contrato da listagem.
  const project = findProject(previewTaskTree, projeto);
  if (!project) notFound();

  const collapsed = parseStageOverrides(cookieStore.get(TASKS_STAGES_COOKIE)?.value);
  const query = parseTasksQuery({
    busca: first(search.busca),
    prioridade: first(search.prioridade),
    prazo: first(search.prazo),
    atrasadas: first(search.atrasadas),
  });

  const board = buildTasksBoard(tasksOfProject(previewTasks, project), query, project.stages);

  return (
    <TasksScreen
      board={board}
      query={query}
      collapsed={collapsed}
      ai={previewAiUsage}
      title={project.name}
      basePath={`/tarefas/`}
      team={previewTaskPeople}
      records={previewRecords}
    />
  );
}
