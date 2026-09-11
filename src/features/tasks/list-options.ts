import type { Icon } from "@phosphor-icons/react";
import { CalendarBlankIcon, FlagIcon, TextAaIcon, WarningCircleIcon } from "@phosphor-icons/react/ssr";
import type { ListboxOption } from "@/components/ui/listbox";
import { priorityLabels } from "./labels";
import type { TaskStage } from "./stages";
import type { Task, TaskPriority } from "./summary";

/**
 * O lado leve da listagem de tarefas: os nomes dos parâmetros, os padrões e as listas prontas para os menus.
 * Separado de `list.ts` porque lá mora o zod que lê a URL no servidor, e a prancha é componente de cliente:
 * importar de lá levaria o zod inteiro para o navegador. Mesma divisão da base de clientes, do catálogo e
 * dos orçamentos.
 */

export const QUERY_PARAM = "busca";
export const PRIORITY_PARAM = "prioridade";
export const DEADLINE_PARAM = "prazo";
export const OVERDUE_PARAM = "atrasadas";

export const priorityFilterValues = ["todas", "low", "normal", "high", "urgent"] as const;
export const deadlineValues = ["7", "30", "sempre"] as const;

export type TasksPriorityFilter = (typeof priorityFilterValues)[number];
export type TasksDeadline = (typeof deadlineValues)[number];

/* Os padrões saem como o valor literal, e não como o tipo largo: é o que deixa a lista de filtros em vigor
   saber que, fora do padrão, prioridade e prazo já não são o de sempre. */
export const DEFAULT_PRIORITY = "todas" satisfies TasksPriorityFilter;
export const DEFAULT_DEADLINE = "sempre" satisfies TasksDeadline;

/* O prazo em três janelas: a semana de trabalho, o mês e tudo. O quadro abre em tudo, porque coluna vazia
   por causa de um filtro que ninguém escolheu leria como quadro quebrado. */
const deadlineLabels: Record<TasksDeadline, string> = {
  "7": "Vencem em 7 dias",
  "30": "Vencem em 30 dias",
  sempre: "Qualquer prazo",
};

export const deadlineOptions: ListboxOption<TasksDeadline>[] = deadlineValues.map((value) => ({
  value,
  label: deadlineLabels[value],
}));

export const priorityFilterLabels: Record<TasksPriorityFilter, string> = {
  todas: "Todas as prioridades",
  low: priorityLabels.low,
  normal: priorityLabels.normal,
  high: priorityLabels.high,
  urgent: priorityLabels.urgent,
};

/** O que a URL carrega: o que a pessoa filtrou. O quadro não tem página, então não há paginação aqui. */
export type TasksQuery = {
  search: string;
  priority: TasksPriorityFilter;
  deadline: TasksDeadline;
  /** Só o que passou do prazo e não fechou. */
  overdue: boolean;
};

export const defaultQuery: TasksQuery = {
  search: "",
  priority: DEFAULT_PRIORITY,
  deadline: DEFAULT_DEADLINE,
  overdue: false,
};

/** Um filtro fora do padrão: o glifo e o nome que a barra mostra, e o que devolve só ele ao padrão. */
export type ActiveTasksFilter = { id: string; label: string; icon: Icon; clear: Partial<TasksQuery> };

/**
 * Os filtros fora do padrão, na ordem em que aparecem no menu: a barra mostra um por etiqueta, e a contagem
 * na quina do funil é o tamanho desta lista, então um lugar só decide o que está em vigor.
 */
export function activeTasksFilters(query: TasksQuery): ActiveTasksFilter[] {
  const list: ActiveTasksFilter[] = [];

  if (query.priority !== DEFAULT_PRIORITY) {
    list.push({ id: "priority", label: priorityFilterLabels[query.priority], icon: FlagIcon, clear: { priority: DEFAULT_PRIORITY } });
  }
  if (query.deadline !== DEFAULT_DEADLINE) {
    list.push({ id: "deadline", label: deadlineLabels[query.deadline], icon: CalendarBlankIcon, clear: { deadline: DEFAULT_DEADLINE } });
  }
  if (query.overdue) {
    list.push({ id: "overdue", label: "Só atrasadas", icon: WarningCircleIcon, clear: { overdue: false } });
  }

  return list;
}

/** Tudo de volta ao padrão, menos a busca: é o que "Limpar filtros" faz. */
export const clearedFilters: Partial<TasksQuery> = {
  priority: DEFAULT_PRIORITY,
  deadline: DEFAULT_DEADLINE,
  overdue: false,
};

/**
 * Como as tarefas de uma coluna são ordenadas por dentro. É escolha de coluna, e não do quadro: cada uma tem
 * o próprio menu, e faz sentido ordenar o backlog por prioridade e o que está em andamento por prazo.
 */
export const columnSortValues = ["deadline", "priority", "title"] as const;

export type TasksColumnSort = (typeof columnSortValues)[number];

export const DEFAULT_COLUMN_SORT = "deadline" satisfies TasksColumnSort;

export const columnSortLabels: Record<TasksColumnSort, string> = {
  deadline: "Prazo",
  priority: "Prioridade",
  title: "Título",
};

export const columnSortIcons: Record<TasksColumnSort, Icon> = {
  deadline: CalendarBlankIcon,
  priority: FlagIcon,
  title: TextAaIcon,
};

/* O peso da bandeira em número, para a ordem por prioridade descer da urgente para a baixa. */
const priorityWeight: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

/**
 * A ordem dentro de uma coluna. Por prazo é a mais próxima primeiro, que é a leitura natural de uma pilha de
 * coisas a fazer; por prioridade a bandeira mais alta primeiro, com o prazo desempatando, senão a coluna
 * embaralhava entre tarefas de mesma prioridade a cada carga; por título é o alfabeto de pt-BR.
 *
 * Mora aqui, e não em `list.ts`, porque a prancha reordena a coluna na tela quando a pessoa escolhe no menu:
 * de lá ela levaria o zod inteiro para o navegador junto.
 */
export function sortColumn(tasks: Task[], sort: TasksColumnSort = DEFAULT_COLUMN_SORT) {
  const ordered = [...tasks];

  if (sort === "title") return ordered.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  if (sort === "priority") {
    return ordered.sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority] || a.dueDate.localeCompare(b.dueDate));
  }
  return ordered.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Uma coluna do quadro: a etapa e as tarefas dela que passaram pelo filtro. */
export type TasksColumn = { stage: TaskStage; tasks: Task[] };

/** O quadro pronto: as cinco colunas na ordem das etapas e quantas tarefas o filtro encontrou ao todo. */
export type TasksBoardData = {
  columns: TasksColumn[];
  /** Quantas passaram pelo filtro, somando as colunas: é o que o vazio da tela lê para saber o que dizer. */
  matched: number;
  /** Quantas existem na base, para separar "não achou nada" de "não tem nada". */
  total: number;
};
