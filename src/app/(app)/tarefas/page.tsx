import { cookies } from "next/headers";
import { getAiUsageData } from "@/features/ai/queries";
import { TasksScreen } from "@/features/tasks/components/tasks-screen";
import { TASKS_STAGES_COOKIE, buildTasksBoard, parseStageOverrides, parseTasksQuery } from "@/features/tasks/list";
import { loadTasksScreenData } from "@/features/tasks/queries";
import { flattenProjects } from "@/features/tasks/tree";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Todas as tarefas",
  description: "Tarefas da equipe, com prazo, situação e quem está envolvido",
  path: "/tarefas",
});

export default async function TasksPage({ searchParams }: PageProps<"/tarefas">) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const collapsed = parseStageOverrides(cookieStore.get(TASKS_STAGES_COOKIE)?.value);
  const query = parseTasksQuery({
    busca: first(params.busca),
    prioridade: first(params.prioridade),
    prazo: first(params.prazo),
    atrasadas: first(params.atrasadas),
  });

  const [data, ai] = await Promise.all([loadTasksScreenData(query), getAiUsageData()]);

  // As colunas são o catálogo de etapas da equipe, na ordem dela (2026-09-21): este quadro cruza projetos
  // com fluxos diferentes, e é o catálogo que reúne numa coluna só o que é a mesma etapa em todos eles.
  const board = buildTasksBoard(data.tasks, query, data.stages);

  /* Aqui a tarefa nasce sem projeto, porque o endereço não diz qual é: a ficha oferece a escolha, e o balde
     continua sendo o padrão. O identificador nulo é o próprio balde, que não é destino de escolha. */
  const projects = flattenProjects(data.tree)
    .filter((project) => project.reference !== null)
    .map((project) => ({ id: project.id, name: project.name, reference: project.reference ?? "", slug: project.slug }));

  return (
    <TasksScreen
      board={board}
      query={query}
      collapsed={collapsed}
      ai={ai}
      basePath="/tarefas"
      team={data.team}
      records={data.records}
      projects={projects}
      stages={data.stages}
    />
  );
}
