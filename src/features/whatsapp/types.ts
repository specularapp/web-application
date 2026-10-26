/*
 * O modelo da caixa de entrada do WhatsApp, no formato da WhatsApp Cloud API (situação de entrega, janela de 24 horas,
 * modelos aprovados). Por enquanto a tela lê dados de exemplo; quando a integração entrar, só a leitura e o envio trocam.
 */

export type DeliveryStatus = "sending" | "sent" | "delivered" | "read" | "failed";

export type MessageAuthor = "contact" | "agent" | "system";

export type MessageKind = "text" | "image" | "audio" | "document" | "template" | "note";

export type MessageAttachment = {
  name: string;
  /** Em bytes. */
  size: number;
  /** Em segundos, para áudio. */
  duration?: number;
};

export type MessageQuote = { id: string; text: string; author: MessageAuthor; kind: MessageKind };

export type WhatsappMessage = {
  id: string;
  author: MessageAuthor;
  /** Quem da equipe escreveu, ou o nome do modelo. */
  authorName?: string;
  kind: MessageKind;
  text: string;
  at: string;
  /** Só nas mensagens que saem da equipe. */
  status?: DeliveryStatus;
  attachment?: MessageAttachment;
  replyTo?: MessageQuote;
  template?: { header?: string; footer?: string; buttons?: string[] };
};

export type ConversationStatus = "aberta" | "aguardando" | "resolvida";

export type ContactSource = "anuncio" | "site" | "indicacao" | "instagram" | "organico";

export type ContactOrigin = {
  campaign?: string;
  ad?: string;
  utmSource?: string;
  utmMedium?: string;
  landingPage?: string;
  device?: string;
  location?: string;
};

export type WhatsappContact = {
  id: string;
  name: string;
  /** Só dígitos, com o código do país: 5511988887777. */
  phone: string;
  email?: string;
  company?: string;
  role?: string;
  city?: string;
  tags: string[];
  source: ContactSource;
  origin?: ContactOrigin;
  /** A etapa do funil em que o contato está. */
  stage: string;
  createdAt: string;
};

export type WhatsappConversation = {
  id: string;
  contact: WhatsappContact;
  status: ConversationStatus;
  assigneeId: string | null;
  /** Mensagens do contato que a equipe ainda não leu. */
  unread: number;
  pinned: boolean;
  starred: boolean;
  /** Desde quando o contato espera a equipe. */
  waitingSince: string | null;
  /** Até quando a janela de 24 horas fica aberta; nula quando o contato nunca escreveu. */
  windowExpiresAt: string | null;
  messages: WhatsappMessage[];
};

export type TeamMember = { id: string; name: string; role: string };

export type MessageTemplate = {
  id: string;
  name: string;
  category: "MARKETING" | "UTILITY";
  /** Corpo com {{1}}, {{2}}… */
  body: string;
  variables: string[];
  header?: string;
  footer?: string;
  buttons?: string[];
};

export type QuickReply = { id: string; shortcut: string; title: string; text: string };

export type ContactStage = { id: string; label: string; hue: string };

export type WhatsappSample = {
  /** O instante em que a amostra foi montada: as datas relativas da tela partem dele. */
  now: string;
  /** Quem está na tela. */
  me: string;
  team: TeamMember[];
  conversations: WhatsappConversation[];
  templates: MessageTemplate[];
  quickReplies: QuickReply[];
  stages: ContactStage[];
};
