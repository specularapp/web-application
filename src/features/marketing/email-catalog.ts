import type { ContactList, EmailBlock, EmailBlockKind, EmailHue, EmailStats, EmailStatus, EmailTemplateCategory } from "./types";

export const emailStatuses: Record<EmailStatus, { label: string; tone: "success" | "info" | "neutral" }> = {
  sent: { label: "Enviado", tone: "success" },
  scheduled: { label: "Agendado", tone: "info" },
  draft: { label: "Rascunho", tone: "neutral" },
};

export const emailCategories: Record<EmailTemplateCategory, string> = {
  "boas-vindas": "Boas-vindas",
  newsletter: "Newsletter",
  oferta: "Oferta",
  relacionamento: "Relacionamento",
  evento: "Evento",
  simples: "Simples",
};

/** O matiz de cada cor do e-mail, em token: a prévia acompanha o tema claro e o escuro. */
export const emailHues: Record<EmailHue, { label: string; value: string }> = {
  blue: { label: "Azul", value: "var(--sys-blue)" },
  green: { label: "Verde", value: "var(--sys-green)" },
  orange: { label: "Laranja", value: "var(--sys-orange)" },
  purple: { label: "Roxo", value: "var(--sys-purple)" },
  pink: { label: "Rosa", value: "var(--sys-pink)" },
  teal: { label: "Turquesa", value: "var(--sys-teal)" },
  indigo: { label: "Índigo", value: "var(--sys-indigo)" },
};

export const emailBlockLabels: Record<EmailBlockKind, string> = {
  heading: "Título",
  text: "Parágrafo",
  button: "Botão",
  image: "Imagem de capa",
  list: "Lista",
  quote: "Depoimento",
  divider: "Divisor",
};

/** As faixas de horas depois do envio, da curva de aberturas do relatório. */
export const EMAIL_HOURS = ["1h", "2h", "4h", "6h", "8h", "12h", "24h", "48h"];

/** As referências do mercado de serviços digitais, em %: a meta dos medidores do relatório. */
export const EMAIL_BENCHMARK = { opens: 32, clicks: 3.5, ctor: 11 };

export const newBlockId = () => `b-${Math.random().toString(36).slice(2, 9)}`;

export function newEmailBlock(kind: EmailBlockKind): EmailBlock {
  const id = newBlockId();
  switch (kind) {
    case "heading":
      return { id, kind, text: "Um título que diz o que mudou" };
    case "text":
      return { id, kind, text: "Escreva aqui o recado em poucas linhas. Use {{primeiro_nome}} para chamar a pessoa pelo nome." };
    case "button":
      return { id, kind, label: "Ver mais", href: "https://" };
    case "image":
      return { id, kind, caption: "Capa do case" };
    case "list":
      return { id, kind, items: ["Primeiro ponto", "Segundo ponto"] };
    case "quote":
      return { id, kind, text: "O site novo dobrou os pedidos de orçamento em dois meses.", author: "Cliente satisfeito" };
    case "divider":
      return { id, kind };
  }
}

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 0 });

export const formatCount = (value: number) => number.format(value);

export const formatRate = (part: number, whole: number) => (whole > 0 ? `${percent.format((part / whole) * 100)}%` : "Sem dados");

export const ratio = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const longDateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export const formatWhen = (iso: string) => dateTime.format(new Date(iso)).replace(/\./g, "");

export const formatLongWhen = (iso: string) => longDateTime.format(new Date(iso));

/** Quantas pessoas recebem: a soma das listas escolhidas, com um desconto pelo contato que está em duas. */
export function estimateReach(lists: ContactList[], ids: string[]) {
  const chosen = lists.filter((list) => ids.includes(list.id));
  const total = chosen.reduce((sum, list) => sum + list.count, 0);
  return chosen.length > 1 ? Math.round(total * 0.88) : total;
}

/** As taxas de um envio: abertura e clique sobre os entregues, clique por abertura sobre os abertos. */
export function emailRates(stats: EmailStats) {
  return {
    delivered: ratio(stats.delivered, stats.recipients),
    opens: ratio(stats.opens, stats.delivered),
    clicks: ratio(stats.clicks, stats.delivered),
    ctor: ratio(stats.clicks, stats.opens),
    unsubscribes: ratio(stats.unsubscribes, stats.delivered),
    bounces: ratio(stats.bounces, stats.recipients),
    spam: ratio(stats.spam, stats.delivered),
  };
}

const previewValues: Record<string, string> = { primeiro_nome: "Camila", empresa: "Estúdio Aurora" };

/** Troca as variáveis pelo exemplo que a prévia mostra. */
export const fillEmailVariables = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => previewValues[key] ?? key);
