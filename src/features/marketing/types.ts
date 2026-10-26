/* ------------------------------------------------ e-mail ----------------------------------------------- */

export type EmailStatus = "draft" | "scheduled" | "sent";

/** A cor do e-mail, sempre um matiz da paleta do sistema, para a prévia valer nos dois temas. */
export type EmailHue = "blue" | "green" | "orange" | "purple" | "pink" | "teal" | "indigo";

export type EmailBlock =
  | { id: string; kind: "heading"; text: string }
  | { id: string; kind: "text"; text: string }
  | { id: string; kind: "button"; label: string; href: string }
  | { id: string; kind: "image"; caption: string }
  | { id: string; kind: "list"; items: string[] }
  | { id: string; kind: "quote"; text: string; author: string }
  | { id: string; kind: "divider" };

export type EmailBlockKind = EmailBlock["kind"];

export type EmailTemplateCategory = "boas-vindas" | "newsletter" | "oferta" | "relacionamento" | "evento" | "simples";

export type EmailTemplate = {
  id: string;
  name: string;
  description: string;
  category: EmailTemplateCategory;
  hue: EmailHue;
  subject: string;
  preheader: string;
  blocks: EmailBlock[];
  /** Salvo pela equipe a partir de um e-mail, e não um dos modelos prontos. */
  custom?: boolean;
};

export type ContactList = {
  id: string;
  name: string;
  description: string;
  count: number;
  kind: "lista" | "segmento";
};

export type EmailLinkStat = { label: string; url: string; clicks: number };

export type EmailStats = {
  recipients: number;
  delivered: number;
  opens: number;
  clicks: number;
  bounces: number;
  unsubscribes: number;
  spam: number;
  links: EmailLinkStat[];
  /** Aberturas por faixa de horas depois do envio, na ordem de `EMAIL_HOURS`. */
  hourly: number[];
};

export type EmailCampaign = {
  id: string;
  name: string;
  subject: string;
  preheader: string;
  fromName: string;
  fromEmail: string;
  /** As listas que recebem. */
  audience: string[];
  status: EmailStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  updatedAt: string;
  createdBy: string;
  templateId: string | null;
  hue: EmailHue;
  blocks: EmailBlock[];
  stats: EmailStats | null;
};

export type EmailSender = { name: string; email: string };

export type EmailData = {
  campaigns: EmailCampaign[];
  templates: EmailTemplate[];
  lists: ContactList[];
  sender: EmailSender;
  /** Quem está na conta: assina o que for criado na tela. */
  author: string;
};

/* ------------------------------------------------ fluxos ----------------------------------------------- */

export type FlowChannel = "instagram" | "whatsapp" | "email";

export type FlowStepKind = "trigger" | "message" | "input" | "ai" | "actions" | "condition" | "randomizer" | "delay" | "jump";

export type FlowTriggerKind =
  | "ig-comment"
  | "ig-dm-keyword"
  | "ig-story-reply"
  | "ig-story-mention"
  | "ig-ad"
  | "ig-link"
  | "wa-keyword"
  | "site-form"
  | "tag-added";

export type FlowTrigger = {
  id: string;
  kind: FlowTriggerKind;
  /** O detalhe que o gatilho pede: a palavra, o post, a etiqueta. */
  value: string;
  /** Respostas públicas ao comentário, sorteadas uma por vez. */
  publicReplies: string[];
};

export type FlowButton = { id: string; label: string };

export type FlowMessage = {
  channel: FlowChannel;
  /** Os balões, em ordem; `{{primeiro_nome}}` vira a etiqueta de variável. */
  texts: string[];
  buttons: FlowButton[];
  /** Espera a pessoa escrever antes de seguir: abre as saídas de resposta. */
  waitReply: boolean;
  subject?: string;
};

export type FlowActionKind = "add-tag" | "remove-tag" | "create-opportunity" | "assign" | "set-field" | "notify-team";

export type FlowAction = { id: string; kind: FlowActionKind; value: string };

export type FlowOperator = "is" | "is-not" | "contains" | "has-tag";

export type FlowRule = { id: string; field: string; operator: FlowOperator; value: string };

export type FlowVariant = { id: string; label: string; weight: number };

export type FlowDelayUnit = "minutos" | "horas" | "dias";

export type FlowDelay = { mode: "for"; amount: number; unit: FlowDelayUnit } | { mode: "until"; time: string };

export type FlowInputField = "email" | "telefone" | "texto";

export type FlowStepData =
  | { kind: "trigger"; triggers: FlowTrigger[] }
  | { kind: "message"; message: FlowMessage }
  | { kind: "input"; question: string; field: FlowInputField; saveAs: string; retry: string }
  | { kind: "ai"; goal: string; handoff: string }
  | { kind: "actions"; actions: FlowAction[] }
  | { kind: "condition"; match: "all" | "any"; rules: FlowRule[] }
  | { kind: "randomizer"; variants: FlowVariant[] }
  | { kind: "delay"; delay: FlowDelay }
  | { kind: "jump"; flowId: string };

export type FlowStep = { id: string; title: string; x: number; y: number; data: FlowStepData };

/** Ligação de uma saída (`port`) de um passo à entrada de outro. */
export type FlowEdge = { id: string; from: string; port: string; to: string };

/** Os números de um passo nos últimos 30 dias: quantos passaram e, por saída, quantos seguiram por ela. */
export type FlowStepStats = { sent: number; clicked: number; ports: Record<string, number> };

export type FlowStatus = "live" | "paused" | "draft";

export type Flow = {
  id: string;
  name: string;
  folder: string;
  status: FlowStatus;
  steps: FlowStep[];
  edges: FlowEdge[];
  stats: Record<string, FlowStepStats>;
  /** Quantos contatos entraram nos últimos 30 dias, e quantos chegaram ao fim. */
  entered: number;
  completed: number;
  updatedAt: string;
  publishedAt: string | null;
  createdBy: string;
};

export type FlowStarterId = "blank" | "ig-comment" | "ig-dm" | "ig-story" | "wa-keyword" | "site-form" | "reactivation";
