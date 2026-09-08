/** Por começar, em andamento ou concluída: é o que decide a etiqueta de situação. */
export type TaskStatus = "upcoming" | "ongoing" | "done";

/** Quanto pesa na fila: sobe a cor da bandeira. */
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type TaskPerson = { name: string; avatarUrl: string | null };

export type Subtask = {
  id: string;
  title: string;
  done: boolean;
  /** Quem cuida dela, quando é alguém em específico. */
  person?: TaskPerson;
};

/** O que o anexo é, que decide o ícone da lista e como a pré-visualização o mostra. */
export type TaskAttachmentType = "pdf" | "image" | "figma" | "link";

export type TaskAttachment = {
  id: string;
  name: string;
  type: TaskAttachmentType;
  /** Onde abre, em nova aba. */
  url: string;
  /** Tamanho legível, como "937 KB"; link e Figma não têm. */
  size?: string;
  /** Situação do arquivo, como "Assinado" ou "Aprovado". */
  label?: string;
};

export type TaskEvent = {
  id: string;
  person: TaskPerson;
  /** O que a pessoa fez, sem o nome: "comentou", "anexou o briefing". */
  action: string;
  /** Quando, em ISO com hora: `yyyy-MM-dd'T'HH:mm`. */
  at: string;
};

export type Task = {
  id: string;
  /** Identificador curto que a pessoa vê, no padrão de `lib/utils/reference.ts`: "TAR-2026-0031". */
  reference: string;
  title: string;
  description: string;
  /** Prazo, no formato `yyyy-MM-dd`. */
  dueDate: string;
  /** Quando começou ou começa, no formato `yyyy-MM-dd`. */
  startDate?: string;
  /** Estimativa de esforço, em minutos. */
  estimate?: number;
  status: TaskStatus;
  priority: TaskPriority;
  /** Quem responde pela tarefa. */
  owner: TaskPerson;
  /** Quem está envolvido, cliente ou pessoa da equipe, na ordem de mostrar. */
  people: TaskPerson[];
  /** A que projeto pertence, quando pertence a um. */
  project?: { name: string; reference: string };
  tags: string[];
  /** Aviso que precisa ser lido antes de mexer, como um pedido do cliente. */
  alert?: string;
  subtasks: Subtask[];
  attachments: TaskAttachment[];
  /** Da mais recente para a mais antiga. */
  activity: TaskEvent[];
};

/** O que o bloco de tarefas do painel mostra: as mais próximas do vencimento, da mais urgente para a mais distante. */
export type TasksSummary = {
  tasks: Task[];
};
