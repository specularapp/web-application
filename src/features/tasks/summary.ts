import type { RecordMedia } from "@/features/records/records";
import type { TaskStage } from "./stages";

/**
 * Por começar, em andamento ou concluída: é o que decide a etiqueta de situação. **Não é campo do modelo**:
 * sai da etapa em que a tarefa está, por `stageStatus` em `labels.ts` (2026-09-10, quando o quadro nasceu).
 * Guardar os dois lado a lado faria a etiqueta dizer uma coisa e a coluna outra assim que alguém movesse o
 * cartão; etapa é o que a pessoa mexe, e situação é a leitura grossa dela.
 */
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
  /**
   * O peso e o prazo dela, quando alguém disse (2026-09-10, a pedido). São próprios, e não herdados da
   * tarefa: subtarefa é trabalho de alguém com data de alguém, e numa lista de quatro costuma ser uma só
   * que aperta. Ausente é o que a tarefa já diz.
   */
  priority?: TaskPriority;
  /** Prazo próprio, no formato `yyyy-MM-dd`. */
  dueDate?: string;
};

/**
 * A que registro da casa a tarefa está vinculada (2026-09-10, a pedido, da referência de ficha de tarefa do
 * usuário): o cliente de quem é o trabalho, o orçamento que o originou, o projeto que o abriga, o contrato
 * que o formaliza. É o que tira a tarefa do vácuo e a liga ao resto do sistema, e é por onde se chega ao
 * documento sem procurar na lista.
 */
export type TaskLinkKind = "client" | "quote" | "project" | "contract";

export type TaskLink = {
  /** O id do registro do outro lado, que é o que monta o endereço dele. */
  id: string;
  kind: TaskLinkKind;
  /** O identificador que a pessoa lê e fala: `CLI-2026-0026`, `ORC-2026-0042`. */
  reference: string;
  name: string;
  /** Linha de apoio, quando ajuda: a empresa do cliente, o valor do orçamento. */
  caption?: string;
  /**
   * O que o vínculo mostra no lugar do azulejo do domínio (2026-09-10, a pedido): o rosto de um cliente, ou
   * as artes dos serviços de um orçamento. É montado onde o dado do outro domínio existe, no servidor, e
   * chega pronto: o rosto por semente e as artes por endereço, as duas coisas serializáveis.
   */
  media?: RecordMedia;
};

/** O que o anexo é, que decide o ícone da lista e como a pré-visualização o mostra. */
export type TaskAttachmentType = "pdf" | "image" | "figma" | "link" | "file";

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
  /**
   * Se é conversa ou registro de mudança (2026-09-10): a coluna de atividade filtra por isto, e sem o campo
   * ela teria de adivinhar pelo texto do `action`, que é livre. Ausente conta como registro.
   */
  kind?: "comment" | "change";
  /**
   * Quem e o que o comentário marcou (2026-09-10, a pedido): o texto guarda o sinal digitado (`@Marina`,
   * `#TAR-2026-0031`) e isto diz o que cada sinal é, para o registro desenhar a pessoa com o rosto e o
   * registro com a etiqueta do domínio em vez de texto cru.
   */
  mentions?: TaskMention[];
  /**
   * O que veio junto da mensagem (2026-09-10, a pedido): os arquivos anexados, no mesmo modelo do anexo da
   * ficha, porque um arquivo é a mesma coisa nos dois lugares e o cartão que o desenha é o mesmo; e o áudio
   * gravado ali, que tem player em vez de cartão.
   */
  files?: TaskAttachment[];
  audio?: TaskAudio;
  /** Quando, em ISO com hora: `yyyy-MM-dd'T'HH:mm`. */
  at: string;
};

/** Um áudio gravado na conversa: onde ele está e quanto tempo dura, para o player não ter de medir. */
export type TaskAudio = { url: string; seconds: number };

/** Uma marcação dentro de um comentário: o sinal que está no texto e o que ele aponta. */
export type TaskMention = {
  /** O trecho exato do texto, com o sinal: `@Marina` ou `#ORC-2026-0042`. */
  token: string;
  /** Pessoa, ou o tipo de registro da aplicação. */
  kind: "person" | "task" | "client" | "quote" | "project" | "contract" | "catalog";
  name: string;
  /** O identificador do registro; pessoa não tem. */
  reference?: string;
  /**
   * A chave do registro no índice da casa (`AppRecord.key`), quando a marcação nasceu de lá: é por ela que a
   * conversa acha o resumo para o cartão e para a ficha que abre ao apontar.
   */
  recordKey?: string;
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
  /** Em que coluna do quadro ela está, e de onde a situação é lida. */
  stage: TaskStage;
  priority: TaskPriority;
  /** Quem responde pela tarefa. */
  owner: TaskPerson;
  /** Quem está envolvido, cliente ou pessoa da equipe, na ordem de mostrar. */
  people: TaskPerson[];
  /** A que projeto pertence, quando pertence a um; o `slug` é o endereço do quadro dele. */
  project?: { name: string; reference: string; slug: string };
  /** Os registros da casa a que ela está ligada, na ordem de mostrar. */
  links: TaskLink[];
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
