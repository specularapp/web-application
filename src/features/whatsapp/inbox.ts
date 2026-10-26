import { applyPattern } from "@/lib/masks";
import { HOUSE_TIME_ZONE, houseDay } from "@/lib/utils/day";
import { slugify } from "@/lib/utils/slug";
import type { ContactSource, ConversationStatus, DeliveryStatus, MessageAuthor, WhatsappConversation, WhatsappMessage } from "./types";

/*
 * As contas da caixa de entrada, puras: datas no fuso da casa (servidor e navegador desenham o mesmo texto), os recortes
 * e filtros da lista e o agrupamento das mensagens por dia.
 */

const DAY = 24 * 60 * 60 * 1000;

const timeFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: HOUSE_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: HOUSE_TIME_ZONE, day: "2-digit", month: "2-digit", year: "2-digit" });
const fullFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: HOUSE_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: HOUSE_TIME_ZONE, weekday: "long" });
const longDateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: HOUSE_TIME_ZONE, day: "numeric", month: "long" });
const longDateYearFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: HOUSE_TIME_ZONE, day: "numeric", month: "long", year: "numeric" });

/** Quantos dias de calendário, no fuso da casa, separam o instante de agora. */
function daysAgo(iso: string, now: string) {
  return Math.round((Date.parse(houseDay(new Date(now))) - Date.parse(houseDay(new Date(iso)))) / DAY);
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const formatTime = (iso: string) => timeFormatter.format(new Date(iso));

export const formatFull = (iso: string) => fullFormatter.format(new Date(iso)).replace(",", " às");

/** A hora na lista: a hora de hoje, "Ontem", o dia da semana até uma semana e a data dali para trás. */
export function formatListTime(iso: string, now: string) {
  const days = daysAgo(iso, now);
  if (days <= 0) return formatTime(iso);
  if (days === 1) return "Ontem";
  if (days < 7) return capitalize(weekdayFormatter.format(new Date(iso)).replace("-feira", ""));
  return shortDateFormatter.format(new Date(iso));
}

/** O selo do dia na conversa. */
export function formatDayDivider(iso: string, now: string) {
  const days = daysAgo(iso, now);
  if (days <= 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days < 7) return capitalize(weekdayFormatter.format(new Date(iso)));
  const sameYear = houseDay(new Date(iso)).slice(0, 4) === houseDay(new Date(now)).slice(0, 4);
  return (sameYear ? longDateFormatter : longDateYearFormatter).format(new Date(iso));
}

export const sameDay = (a: string, b: string) => houseDay(new Date(a)) === houseDay(new Date(b));

/** O telefone guardado em dígitos com o código do país, como a pessoa lê: +55 (11) 98888-7777. */
export function formatPhone(digits: string) {
  const local = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  return `+55 ${applyPattern("phone", local)}`;
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export const windowOpen = (expiresAt: string | null, now: string) => expiresAt !== null && Date.parse(expiresAt) > Date.parse(now);

export function formatSize(bytes: number) {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1_000))} KB`;
}

export const formatDuration = (seconds = 0) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

/** O tipo do documento pela extensão, como o WhatsApp mostra. */
export const documentType = (name: string) => name.split(".").pop()?.toUpperCase().slice(0, 5) || "Arquivo";

/** O corpo do modelo com as variáveis no lugar de {{1}}, {{2}}… */
export const fillTemplate = (body: string, values: string[]) => body.replace(/\{\{(\d+)\}\}/g, (match, index: string) => values[Number(index) - 1] || match);

export const statusLabels: Record<ConversationStatus, string> = { aberta: "Aberta", aguardando: "Aguardando", resolvida: "Resolvida" };

export const deliveryLabels: Record<DeliveryStatus, string> = { sending: "Enviando", sent: "Enviada", delivered: "Entregue", read: "Lida", failed: "Não entregue" };

export const sourceLabels: Record<ContactSource, string> = { anuncio: "Anúncio", site: "Site", indicacao: "Indicação", instagram: "Instagram", organico: "Orgânico" };

export const authorLabel = (author: MessageAuthor, contactName: string) => (author === "contact" ? contactName : "Você");

export const lastMessage = (conversation: WhatsappConversation): WhatsappMessage | null => conversation.messages.at(-1) ?? null;

/* ---------- Recortes e filtros ---------- */

export type InboxTab = "todas" | "nao-lidas" | "aguardando" | "minhas" | "favoritas" | "fixadas";

export type InboxPeriod = "qualquer" | "hoje" | "7d" | "30d";
export type InboxWindow = "qualquer" | "aberta" | "fechada";
/** Quem falou por último: o contato (falta responder) ou a equipe. */
export type InboxReply = "qualquer" | "sem-resposta" | "respondida";

export type InboxFilters = {
  period: InboxPeriod;
  window: InboxWindow;
  status: ConversationStatus[];
  pinnedOnly: boolean;
  reply: InboxReply;
  /** Ids da equipe; vazio é "sem responsável". */
  assignees: string[];
  tags: string[];
  stages: string[];
};

export const NO_FILTERS: InboxFilters = { period: "qualquer", window: "qualquer", status: [], pinnedOnly: false, reply: "qualquer", assignees: [], tags: [], stages: [] };

/** Quantos grupos do menu de filtros estão em vigor: é o número na quina do botão. */
export function activeFilterCount(filters: InboxFilters) {
  return [
    filters.period !== "qualquer",
    filters.window !== "qualquer",
    filters.status.length > 0,
    filters.pinnedOnly,
    filters.reply !== "qualquer",
    filters.assignees.length > 0,
    filters.tags.length > 0,
    filters.stages.length > 0,
  ].filter(Boolean).length;
}

/** Esperando a equipe e ainda sem ninguém: a conversa que já tem responsável segue com ele, em Minhas. */
export const awaitingTeam = (conversation: WhatsappConversation) => conversation.waitingSince !== null && !conversation.assigneeId;

export const lastFromContact = (conversation: WhatsappConversation) => lastMessage(conversation)?.author === "contact";

/** Já lida, o contato por último e a conversa em aberto: vista e sem resposta. */
export const seenUnanswered = (conversation: WhatsappConversation) =>
  lastFromContact(conversation) && conversation.unread === 0 && conversation.status !== "resolvida" && !awaitingTeam(conversation);

function sincePeriod(period: InboxPeriod, now: string) {
  if (period === "hoje") return Date.parse(`${houseDay(new Date(now))}T00:00:00-03:00`);
  return period === "7d" ? Date.parse(now) - 7 * DAY : period === "30d" ? Date.parse(now) - 30 * DAY : null;
}

function matchesTab(conversation: WhatsappConversation, tab: InboxTab, me: string) {
  if (tab === "nao-lidas") return conversation.unread > 0;
  if (tab === "aguardando") return awaitingTeam(conversation);
  if (tab === "minhas") return conversation.assigneeId === me;
  if (tab === "fixadas") return conversation.pinned;
  if (tab === "favoritas") return conversation.starred;
  return true;
}

export function filterInbox(conversations: WhatsappConversation[], tab: InboxTab, query: string, me: string, filters: InboxFilters, now: string) {
  const term = slugify(query, 80);
  const digits = query.replace(/\D/g, "");
  const since = sincePeriod(filters.period, now);
  return conversations.filter((conversation) => {
    const { contact } = conversation;
    const last = lastMessage(conversation);
    if (term && !slugify(`${contact.name} ${contact.company ?? ""} ${last?.text ?? ""}`, 400).includes(term) && !(digits.length >= 3 && contact.phone.includes(digits))) return false;
    if (!matchesTab(conversation, tab, me)) return false;
    if (since !== null && (!last || Date.parse(last.at) < since)) return false;
    if (filters.window !== "qualquer" && windowOpen(conversation.windowExpiresAt, now) !== (filters.window === "aberta")) return false;
    if (filters.status.length > 0 && !filters.status.includes(conversation.status)) return false;
    if (filters.pinnedOnly && !conversation.pinned) return false;
    if (filters.reply !== "qualquer") {
      const pending = lastFromContact(conversation);
      if (filters.reply === "sem-resposta" ? !pending : pending || !last) return false;
    }
    if (filters.assignees.length > 0 && !filters.assignees.includes(conversation.assigneeId ?? "")) return false;
    if (filters.tags.length > 0 && !filters.tags.some((tag) => contact.tags.includes(tag))) return false;
    if (filters.stages.length > 0 && !filters.stages.includes(contact.stage)) return false;
    return true;
  });
}

/** A mais recente primeiro. */
export const byLastMessage = (a: WhatsappConversation, b: WhatsappConversation) => (lastMessage(b)?.at ?? "").localeCompare(lastMessage(a)?.at ?? "");

/* ---------- Mensagens por dia ---------- */

/** Mensagens do mesmo autor, no mesmo dia e até 5 minutos uma da outra, formam um bloco: só a primeira leva o rabinho. */
const BLOCK_MS = 5 * 60_000;

export type DayGroup = { key: string; at: string; items: { message: WhatsappMessage; first: boolean }[] };

export function groupByDay(messages: WhatsappMessage[]): DayGroup[] {
  const groups: DayGroup[] = [];
  messages.forEach((message, index) => {
    const previous = messages[index - 1];
    const newDay = !previous || !sameDay(previous.at, message.at);
    if (newDay) groups.push({ key: message.id, at: message.at, items: [] });
    const changes =
      !previous ||
      previous.author !== message.author ||
      (previous.kind === "note") !== (message.kind === "note") ||
      Date.parse(message.at) - Date.parse(previous.at) > BLOCK_MS;
    groups[groups.length - 1].items.push({ message, first: newDay || changes });
  });
  return groups;
}
