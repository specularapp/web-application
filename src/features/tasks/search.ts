import { format, parseISO } from "date-fns";
import { slugify } from "@/lib/utils/slug";
import { dueOf, priorityLabels, statusLabels, statusOf } from "./labels";
import type { Task } from "./summary";

/**
 * A busca de tarefas, a mesma no servidor e na tela (2026-09-23, a pedido de a busca achar por tudo): o
 * servidor filtra o que a URL pede, e o quadro filtra enquanto a pessoa digita, sem esperar a volta.
 *
 * Cada palavra digitada precisa aparecer em algum lugar da tarefa, em qualquer ordem: "marca yago urgente"
 * acha a tarefa urgente de etiqueta Marca em que o Yago está envolvido. Acento, maiúscula, `#` e `@` não
 * atrapalham, porque os dois lados são comparados no formato de endereço.
 *
 * O que entra no palheiro é o que identifica uma tarefa numa lista: título, descrição, identificador,
 * projeto, etiquetas, responsável e envolvidos, etapa, prioridade, situação, subtarefas, aviso e o prazo, na
 * data (`23/09`, `23/09/2026`) e no rótulo do cartão (`hoje`, `ontem`, `atrasada`).
 */

/* O palheiro é montado uma vez por tarefa: a mesma tarefa é comparada a cada tecla, e o objeto só muda
   quando ela muda, então a identidade dele é a chave certa. */
const haystacks = new WeakMap<Task, string>();

function haystackOf(task: Task) {
  const known = haystacks.get(task);
  if (known !== undefined) return known;

  const due = parseISO(task.dueDate);
  const fields = [
    task.title,
    task.description,
    task.reference,
    task.project?.name ?? "",
    task.project?.reference ?? "",
    ...task.tags,
    task.owner.name,
    ...task.people.map((person) => person.name),
    task.stage.name,
    priorityLabels[task.priority],
    statusLabels[statusOf(task)],
    ...task.subtasks.map((subtask) => subtask.title),
    task.alert ?? "",
    Number.isNaN(due.getTime()) ? "" : `${format(due, "dd-MM-yyyy")} ${format(due, "d-M")}`,
    dueOf(task).label,
  ];

  const haystack = ` ${fields.map((field) => slugify(field, 400)).join(" ")} `;
  haystacks.set(task, haystack);
  return haystack;
}

/** As palavras da busca no formato do palheiro, sem as vazias. */
export function searchTerms(search: string) {
  return search
    .split(/\s+/)
    .map((term) => slugify(term, 80))
    .filter(Boolean);
}

/** Se a tarefa tem todas as palavras. Busca vazia deixa tudo passar. */
export function taskMatches(task: Task, terms: string[]) {
  if (terms.length === 0) return true;
  const haystack = haystackOf(task);
  return terms.every((term) => haystack.includes(term));
}
