import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { BadgeTone } from "@/components/ui/badge";
import { taskStageMeta, type TaskStage } from "./stages";
import type { Task, TaskPerson, TaskPriority, TaskStatus } from "./summary";

/** Quantos caracteres a fila de nomes ocupa antes de virar reticência mais a contagem do resto. */
const NAME_BUDGET = 32;

/**
 * Os primeiros nomes que cabem no orçamento de caracteres, e quantos ficaram de fora. O corte é por
 * caractere, e não por quantidade de gente: "Ana, Léo e Bia" e "Alexandre e Guilherme" têm larguras
 * muito diferentes com o mesmo número de nomes, então contar pessoas deixaria a linha quebrar num caso
 * e sobrar espaço no outro. O primeiro nome entra sempre, mesmo passando do orçamento, senão a fila
 * ficaria só com a contagem.
 */
export function peopleLabel(people: TaskPerson[], budget = NAME_BUDGET) {
  const first = people.map((person) => person.name.split(" ")[0] ?? person.name);
  const shown: string[] = [];
  let length = 0;

  for (const name of first) {
    const next = shown.length === 0 ? name.length : length + 2 + name.length;
    if (shown.length > 0 && next > budget) break;
    shown.push(name);
    length = next;
  }

  return { names: shown.join(", "), rest: first.length - shown.length };
}

/* A situação em três tons: "A começar" em `success`, "Em andamento" em `accent` e "Concluída" em neutro. */
export const statusLabels: Record<TaskStatus, string> = { upcoming: "A começar", ongoing: "Em andamento", done: "Concluída" };
export const statusTones: Record<TaskStatus, BadgeTone> = { upcoming: "success", ongoing: "accent", done: "neutral" };

/**
 * A situação lida a partir da etapa (2026-09-10, quando o quadro nasceu): as colunas do kanban são mais
 * finas que os três estados que o painel e a ficha mostram, então quem converte é o `kind` que cada etapa do
 * catálogo declara. É a única conversão entre as duas leituras, e é por isso que o modelo guarda só a etapa.
 *
 * Sai do catálogo, e não de um mapa escrito aqui: com dois mapas, acrescentar uma etapa deixaria um dos dois
 * sem ela, e a tarefa apareceria sem situação. Como o `kind` mora junto da etapa, etapa nova já nasce com a
 * própria leitura, e quem lê aqui não precisa saber de qual projeto a tarefa é.
 */
export const stageStatus = (stage: TaskStage): TaskStatus => taskStageMeta[stage].kind;

export const statusOf = (task: Task) => stageStatus(task.stage);

/**
 * A estimativa de esforço em horas e minutos, como a pessoa fala: "45 min", "4 h", "2 h 30 min". Nasceu
 * dentro da ficha da tarefa e subiu para cá em 2026-09-10, quando o cartão do quadro passou a mostrar o
 * mesmo número: escrita nos dois lugares, ela sairia de sincronia no primeiro acerto de formato.
 */
export function estimateLabel(minutes: number) {
  /* Dia de 24 horas, e não dia útil de oito: a roleta da ficha oferece as 24 horas do dia (2026-09-10, a
     pedido), e com dia de oito o rótulo diria "2 d 7 h" para o que a pessoa escolheu como 23 h. */
  const days = Math.floor(minutes / DAY_MINUTES);
  const hours = Math.floor((minutes % DAY_MINUTES) / 60);
  const rest = minutes % 60;
  const parts = [days > 0 && `${days} d`, hours > 0 && `${hours} h`, rest > 0 && `${rest} min`].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "0 min";
}

/** Quantos minutos tem um dia: as 24 horas, que é a faixa que o seletor de estimativa oferece. */
export const DAY_MINUTES = 24 * 60;

/** Quantas subtarefas já estão marcadas, que é o numerador do progresso do cartão e da ficha. */
export const subtasksDone = (task: Task) => task.subtasks.filter((subtask) => subtask.done).length;

/* A prioridade sobe de cor com o peso: neutra, azul, laranja e vermelha. */
export const priorityLabels: Record<TaskPriority, string> = { low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente" };
export const priorityTones: Record<TaskPriority, BadgeTone> = { low: "neutral", normal: "info", high: "warning", urgent: "danger" };

/**
 * O mesmo tom da etiqueta, mas como token de cor: é o que um controle que não é `Badge` precisa para se
 * tingir, como o seletor de prioridade da janela da tarefa (2026-09-10). Anda junto de `priorityTones`, que é
 * a mesma escala pelo nome do tom.
 */
export const priorityHues: Record<TaskPriority, string> = {
  low: "var(--sys-gray)",
  normal: "var(--color-info)",
  high: "var(--color-warning)",
  urgent: "var(--color-danger)",
};

// O prazo em uma palavra quando dá: hoje em vermelho, amanhã em laranja, e o resto pela data. Tarefa
// aberta com o prazo vencido também fica em vermelho, porque é a mais urgente da lista; concluída no
// passado fica neutra.
export function dueOf(task: Task): { label: string; tone: BadgeTone } {
  const date = parseISO(task.dueDate);
  const days = differenceInCalendarDays(date, new Date());
  const overdue = days < 0 && statusOf(task) !== "done";

  if (days === 0) return { label: "Hoje", tone: "danger" };
  if (days === 1) return { label: "Amanhã", tone: "warning" };
  if (days === -1) return { label: "Ontem", tone: overdue ? "danger" : "neutral" };
  return { label: format(date, "d MMM.", { locale: ptBR }), tone: overdue ? "danger" : "neutral" };
}
