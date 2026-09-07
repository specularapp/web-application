/** Por começar, em andamento ou concluída: é o que decide a etiqueta de situação. */
export type TaskStatus = "upcoming" | "ongoing" | "done";

export type TaskPerson = { name: string; avatarUrl: string | null };

export type Task = {
  id: string;
  title: string;
  description: string;
  /** Prazo, no formato `yyyy-MM-dd`. */
  dueDate: string;
  status: TaskStatus;
  /** Quem está envolvido, cliente ou pessoa da equipe, na ordem de mostrar. */
  people: TaskPerson[];
};

/** O que o bloco de tarefas do painel mostra: as mais próximas do vencimento, da mais urgente para a mais distante. */
export type TasksSummary = {
  tasks: Task[];
};
