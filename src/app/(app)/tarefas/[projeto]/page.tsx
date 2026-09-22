import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getAiUsageData } from "@/features/ai/queries";
import { getTasksTree } from "@/features/projects/queries";
import { TasksScreen } from "@/features/tasks/components/tasks-screen";
import { TASKS_STAGES_COOKIE, buildTasksBoard, parseStageOverrides, parseTasksQuery } from "@/features/tasks/list";
import { loadTasksScreenData } from "@/features/tasks/queries";
import { findProject } from "@/features/tasks/tree";
import type { ProjectHue } from "@/features/projects/summary";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

/** O nome do projeto no título da aba: é o quadro dele que a página abre, e não "Tarefas" outra vez. */
export async function generateMetadata({ params }: PageProps<"/tarefas/[projeto]">) {
  const { projeto } = await params;
  const project = findProject(await getTasksTree(), projeto);

  return createMetadata({
    title: project ? project.name : "Projeto",
    description: "Quadro de tarefas do projeto, com as etapas do fluxo dele",
    path: `/tarefas/${projeto}`,
    noIndex: true,
  });
}

// O quadro de um projeto: a mesma tela de todas as tarefas, com três diferenças que vêm da arquitetura —
// só as tarefas dele, **as etapas que ele declara**, e o nome dele no topo. As etapas são do projeto de
// propósito: é isso que faz o quadro ser dele, e não um recorte do quadro geral.
export default async function TaskProjectPage({ params, searchParams }: PageProps<"/tarefas/[projeto]">) {
  const [{ projeto }, search, cookieStore] = await Promise.all([params, searchParams, cookies()]);

  const collapsed = parseStageOverrides(cookieStore.get(TASKS_STAGES_COOKIE)?.value);
  const query = parseTasksQuery({
    busca: first(search.busca),
    prioridade: first(search.prioridade),
    prazo: first(search.prazo),
    atrasadas: first(search.atrasadas),
  });

  const [data, ai] = await Promise.all([loadTasksScreenData(query, projeto), getAiUsageData()]);
  if (!data.project) notFound();

  /* As colunas são as do projeto; sem nenhuma escolhida, ele acompanha o catálogo da equipe, que é o que
     faz um quadro recém-criado já nascer com caminho em vez de vazio. */
  const columns = data.project.stages.length > 0 ? data.project.stages : data.stages;
  const board = buildTasksBoard(data.tasks, query, columns);

  return (
    <TasksScreen
      board={board}
      query={query}
      collapsed={collapsed}
      ai={ai}
      title={data.project.name}
      basePath={`/tarefas/${projeto}`}
      team={data.team}
      records={data.records}
      projectId={data.project.id}
      stages={data.stages}
      projectStages={data.project.stages}
      project={{ id: data.project.id, name: data.project.name, hue: data.project.paletteHue as ProjectHue, glyph: data.project.glyph }}
    />
  );
}
