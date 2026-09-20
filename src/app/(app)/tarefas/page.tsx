import { cookies } from "next/headers";
import { getAiUsageData } from "@/features/ai/queries";
import { TasksScreen } from "@/features/tasks/components/tasks-screen";
import { TASKS_STAGES_COOKIE, buildTasksBoard, parseStageOverrides, parseTasksQuery } from "@/features/tasks/list";
import { loadTasksScreenData } from "@/features/tasks/queries";
import { boardStages } from "@/features/tasks/tree";
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

  // As colunas são as etapas que os projetos escolheram, e não uma lista fixa: este quadro cruza projetos
  // com fluxos diferentes, e cada projeto tem as etapas dele, então uma lista fixa esconderia o que está numa
  // etapa que só um dos projetos usa.
  const board = buildTasksBoard(data.tasks, query, boardStages(data.tasks, data.tree));

  return <TasksScreen board={board} query={query} collapsed={collapsed} ai={ai} basePath="/tarefas" team={data.team} records={data.records} />;
}
