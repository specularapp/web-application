import { differenceInCalendarDays, parseISO } from "date-fns";
import { z } from "zod";
import { slugify } from "@/lib/utils/slug";
import { statusOf } from "./labels";
import type { StageOverrides } from "./board-cookie";
import { deadlineValues, defaultQuery, priorityFilterValues, sortColumn, type TasksBoardData, type TasksQuery } from "./list-options";
import { stageValues, type TaskStage } from "./stages";
import type { Task } from "./summary";

/**
 * A regra da listagem de tarefas: ler o que a URL pede, filtrar e agrupar por etapa. Roda no servidor, porque
 * parâmetro de URL é entrada de usuário e a lista virá do banco. Recebe as tarefas de fora e não sabe de onde
 * vêm, então trocar a prévia pela consulta não mexe em nada daqui.
 */

/* O nome do cookie das etapas e a escrita dele moram em `board-cookie.ts`, que não carrega zod. Segue saindo
   daqui para quem lê o quadro no servidor. */
export { TASKS_STAGES_COOKIE, type StageOverrides } from "./board-cookie";

/* Valor fora da lista cai no padrão em vez de derrubar a página: a URL é digitável e vem de link antigo. */
/* Filtro de liga e desliga na URL: presente com "1" liga, qualquer outra coisa ou ausente desliga. */
const flag = z
  .string()
  .optional()
  .transform((value) => value === "1")
  .catch(false);

const querySchema = z.object({
  search: z.string().trim().max(80).catch(""),
  priority: z.enum(priorityFilterValues).catch(defaultQuery.priority),
  deadline: z.enum(deadlineValues).catch(defaultQuery.deadline),
  overdue: flag,
});

export function parseTasksQuery(params: Record<string, string | undefined>): TasksQuery {
  return querySchema.parse({
    search: params.busca ?? "",
    priority: params.prioridade,
    deadline: params.prazo,
    overdue: params.atrasadas,
  });
}

/**
 * Lê o cookie do que a pessoa decidiu em cada etapa, porque cookie é entrada de usuário: entrada que não é
 * `etapa:0` ou `etapa:1` cai fora, e etapa repetida vale a última. Sem cookie, ninguém decidiu nada e todas
 * as etapas ficam no padrão delas.
 */
export function parseStageOverrides(raw: string | undefined): StageOverrides {
  const listed = z
    .string()
    .transform((value) => value.split(","))
    .catch([] as string[])
    .parse(raw);

  const overrides: StageOverrides = {};
  for (const entry of listed) {
    const [stage, flag] = entry.split(":");
    if (!stageValues.includes(stage as TaskStage) || (flag !== "0" && flag !== "1")) continue;
    overrides[stage as TaskStage] = flag === "1";
  }
  return overrides;
}

/* A busca compara pelo mesmo formato dos dois lados, então acento e maiúscula não atrapalham. Ela varre o
   que identifica a tarefa numa lista: o título, a descrição, o identificador que a pessoa lê e fala, as
   etiquetas, o projeto e quem está envolvido, porque procurar pelo nome de alguém é o jeito mais comum de
   achar a tarefa da pessoa. */
function matches(task: Task, search: string) {
  if (!search) return true;
  const needle = slugify(search, 80);
  const haystack = [
    task.title,
    task.description,
    task.reference,
    task.project?.name ?? "",
    ...task.tags,
    task.owner.name,
    ...task.people.map((person) => person.name),
  ];
  return haystack.some((entry) => slugify(entry, 200).includes(needle));
}

function withinDeadline(task: Task, deadline: TasksQuery["deadline"]) {
  if (deadline === "sempre") return true;
  /* Passado conta como dentro da janela: o que já venceu é o mais urgente que existe, e esconder isso num
     filtro de prazo curto seria o contrário do que a pessoa pediu ao apertar a janela. */
  return differenceInCalendarDays(parseISO(task.dueDate), new Date()) <= Number(deadline);
}

const isOverdue = (task: Task) => differenceInCalendarDays(parseISO(task.dueDate), new Date()) < 0 && statusOf(task) !== "done";

/**
 * Filtra e distribui as tarefas nas colunas que o quadro pediu, na ordem em que elas vêm. **As etapas chegam
 * de fora** (2026-09-10): o quadro de um projeto recebe as dele, e o de todas as tarefas recebe as que estão
 * em uso, porque cruza projetos com fluxos diferentes. A coluna sai ordenada pelo padrão da casa; quem quiser
 * outra ordem reordena na tela, porque a escolha é de coluna e vive na sessão. Etapa sem tarefa nenhuma
 * continua no quadro: coluna é lugar, e não conteúdo, então ela existe mesmo vazia.
 */
export function buildTasksBoard(tasks: Task[], query: TasksQuery, stages: TaskStage[]): TasksBoardData {
  const filtered = tasks.filter(
    (task) =>
      matches(task, query.search) &&
      withinDeadline(task, query.deadline) &&
      (query.priority === "todas" || task.priority === query.priority) &&
      (!query.overdue || isOverdue(task)),
  );

  return {
    columns: stages.map((stage) => ({
      stage,
      tasks: sortColumn(filtered.filter((task) => task.stage === stage)),
    })),
    matched: filtered.length,
    total: tasks.length,
  };
}
