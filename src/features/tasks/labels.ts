import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { BadgeTone } from "@/components/ui/badge";
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

/* A prioridade sobe de cor com o peso: neutra, azul, laranja e vermelha. */
export const priorityLabels: Record<TaskPriority, string> = { low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente" };
export const priorityTones: Record<TaskPriority, BadgeTone> = { low: "neutral", normal: "info", high: "warning", urgent: "danger" };

// O prazo em uma palavra quando dá: hoje em vermelho, amanhã em laranja, e o resto pela data. Tarefa
// aberta com o prazo vencido também fica em vermelho, porque é a mais urgente da lista; concluída no
// passado fica neutra.
export function dueOf(task: Task): { label: string; tone: BadgeTone } {
  const date = parseISO(task.dueDate);
  const days = differenceInCalendarDays(date, new Date());
  const overdue = days < 0 && task.status !== "done";

  if (days === 0) return { label: "Hoje", tone: "danger" };
  if (days === 1) return { label: "Amanhã", tone: "warning" };
  if (days === -1) return { label: "Ontem", tone: overdue ? "danger" : "neutral" };
  return { label: format(date, "d MMM.", { locale: ptBR }), tone: overdue ? "danger" : "neutral" };
}
