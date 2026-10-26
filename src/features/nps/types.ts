/** A leitura da nota: 9 e 10 promovem, 7 e 8 são neutros, de 0 a 6 detratam. */
export type NpsGroup = "promoter" | "passive" | "detractor";

/** A linha de serviço do projeto avaliado, que faz o papel de recorte do painel. */
export type NpsService = "site" | "app" | "branding" | "ecommerce" | "support";

/** Por onde a resposta chegou. */
export type NpsChannel = "email" | "whatsapp" | "link";

export type QuestionKind = "nps" | "stars" | "choice" | "multiple" | "yesNo" | "text";

export type Question = {
  id: string;
  kind: QuestionKind;
  title: string;
  help: string;
  required: boolean;
  options: string[];
  /** Nas estrelas: o aspecto que a nota mede no painel, como "Comunicação". */
  aspect: string;
  /** Para quem aparece, pela nota dada; vazio é para todos. */
  showTo: NpsGroup[];
};

export type SurveyStatus = "active" | "paused" | "draft" | "archived";

export type SurveyThanks = { title: string; text: string };

export type Survey = {
  id: string;
  name: string;
  status: SurveyStatus;
  services: NpsService[];
  /** A saudação do topo; `{nome}` e `{projeto}` viram o primeiro nome do cliente e o nome do projeto. */
  intro: string;
  questions: Question[];
  thanks: Record<NpsGroup, SurveyThanks>;
  /** Promotor é convidado a deixar um depoimento para o portfólio. */
  testimonial: boolean;
  /** Aceita resposta pelo link aberto, sem envio individual. */
  publicLink: boolean;
  accent: string;
  updatedAt: string;
  updatedBy: string;
};

export type Answer = number | string | string[] | boolean;

export type NpsContact = { name: string; company: string; email: string; phone: string };

export type NpsProject = { id: string; name: string; reference: string; service: NpsService };

export type NpsClient = { id: string; contact: NpsContact; project: NpsProject };

export type TreatmentStatus = "open" | "contacted" | "review" | "adjustment" | "resolved" | "noReply";

export type TreatmentEventKind = "created" | "note" | "contact" | "status" | "owner";

export type TreatmentEvent = { id: string; at: string; by: string; kind: TreatmentEventKind; text: string };

export type Treatment = {
  id: string;
  responseId: string;
  status: TreatmentStatus;
  ownerId: string | null;
  createdAt: string;
  /** O prazo para o primeiro contato. */
  dueAt: string;
  firstContactAt: string | null;
  closedAt: string | null;
  /** Ao fechar: o cliente saiu satisfeito ou não. */
  recovered: boolean | null;
  events: TreatmentEvent[];
};

export type NpsResponse = {
  id: string;
  surveyId: string;
  clientId: string;
  channel: NpsChannel;
  sentAt: string | null;
  answeredAt: string;
  score: number;
  answers: Record<string, Answer>;
  comment: string;
  themes: string[];
  treatmentId: string | null;
};

export type DispatchEvent = "projectDone" | "deliveryApproved" | "chargePaid" | "supportCheck";

export type DispatchRule = {
  id: string;
  name: string;
  active: boolean;
  surveyId: string;
  services: NpsService[];
  event: DispatchEvent;
  /** Horas depois do evento. */
  delayHours: number;
  channel: "email" | "whatsapp";
  /** O assunto do e-mail ou a primeira linha da mensagem. */
  message: string;
  /** Lembrete se não responder em N horas; nulo sem lembrete. */
  reminderHours: number | null;
  /** Não envia entre esses horários: espera o fim da janela. */
  quietFrom: string;
  quietTo: string;
  /** Não pergunta de novo a quem respondeu nos últimos N dias. */
  cooldownDays: number;
};

export type SendStatus = "scheduled" | "sent" | "delivered" | "read" | "answered" | "failed" | "cancelled";

export type NpsSend = {
  id: string;
  ruleId: string | null;
  surveyId: string;
  clientId: string;
  channel: NpsChannel;
  scheduledAt: string;
  sentAt: string | null;
  status: SendStatus;
  reminded: boolean;
  responseId: string | null;
  error: string;
};

export type NpsMember = { id: string; name: string; role: string };

/** Tudo que as telas do NPS leem, do mesmo jeito que a consulta do banco vai entregar. */
export type NpsData = {
  now: string;
  team: NpsMember[];
  clients: NpsClient[];
  surveys: Survey[];
  responses: NpsResponse[];
  treatments: Treatment[];
  rules: DispatchRule[];
  sends: NpsSend[];
};
