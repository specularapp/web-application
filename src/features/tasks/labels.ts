import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { BadgeTone } from "@/components/ui/badge";
import type { Task, TaskPriority, TaskStatus } from "./summary";

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
