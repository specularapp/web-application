import { cookies } from "next/headers";
import { previewAiUsage } from "@/features/ai/preview";
import { TasksScreen } from "@/features/tasks/components/tasks-screen";
import { TASKS_STAGES_COOKIE, buildTasksBoard, parseStageOverrides, parseTasksQuery } from "@/features/tasks/list";
import { previewRecords } from "@/features/records/preview";
import { previewTaskPeople, previewTasks } from "@/features/tasks/list-preview";
import { stagesInUse } from "@/features/tasks/tree";
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

  // As tarefas vêm de `list-preview` enquanto o domínio não existe no banco: quando a tabela nascer, muda só
  // esta linha, porque quem filtra e distribui nas etapas é `buildTasksBoard`, que recebe a lista de fora e
  // não sabe de onde ela veio.
  //
  // As colunas são as **etapas em uso**, e não uma lista fixa: este quadro cruza projetos com fluxos
  // diferentes, e cada projeto tem as etapas dele, então uma lista fixa esconderia o que está numa etapa que
  // só um dos projetos usa. A conta é sobre a base inteira, e não sobre o que o filtro deixou, senão as
  // colunas apareceriam e desapareceriam a cada busca.
  const board = buildTasksBoard(previewTasks, query, stagesInUse(previewTasks));

  // O uso da IA vem de `features/ai/preview.ts`, no mesmo contrato das outras telas: o widget do topo recebe
  // por prop e não sabe de onde vem.
  return <TasksScreen board={board} query={query} collapsed={collapsed} ai={previewAiUsage} basePath="/tarefas" team={previewTaskPeople} records={previewRecords} />;
}
