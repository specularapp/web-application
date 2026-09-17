import { differenceInCalendarDays, format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Route } from "next";

/** O que o aviso anuncia: decide o texto de apoio e o nome que o leitor de tela diz antes do título. */
export type AlertKind = "meeting" | "delivery" | "invoice" | "task";

export type AlertPerson = { name: string; avatarUrl: string | null };

/**
 * Um aviso do cartão do menu: reunião com cliente marcada, entrega chegando, cobrança vencendo, tarefa
 * no prazo. `startsAt` é quando acontece, `people` são as pessoas envolvidas (cliente, equipe) que viram
 * bolinhas, e `action` leva a quem resolve: entrar na chamada, abrir o projeto, ver a cobrança.
 */
export type SidebarAlert = {
  id: string;
  kind: AlertKind;
  title: string;
  /** Linha de apoio pronta, como "9:00 a 9:30 no Zoom" ou "Vence em 2 dias". */
  detail: string;
  /** Quando acontece, em ISO, para escolher o mais urgente. */
  startsAt: string;
  people: AlertPerson[];
  action: { label: string; href: Route | `http${string}` };
};

export const alertKindLabels: Record<AlertKind, string> = {
  meeting: "Reunião",
  delivery: "Entrega",
  invoice: "Cobrança",
  task: "Tarefa",
};

type Timed = { startsAt: Date; endsAt?: Date; channel?: string };

/** "9:00 a 9:30 no Zoom" hoje, "Amanhã, 9:00 a 9:30 no Zoom" depois; para prazos, "Vence hoje", "Vence amanhã", "Vence em 3 dias", "Venceu ontem". */
export function describeAlert(kind: AlertKind, when: Timed, now: Date) {
  if (kind === "meeting") {
    const range = when.endsAt ? `${format(when.startsAt, "H:mm")} a ${format(when.endsAt, "H:mm")}` : format(when.startsAt, "H:mm");
    const where = when.channel ? ` no ${when.channel}` : "";
    if (isSameDay(when.startsAt, now)) return `${range}${where}`;
    const days = differenceInCalendarDays(when.startsAt, now);
    const day = days === 1 ? "Amanhã" : format(when.startsAt, "EEEE, d MMM.", { locale: ptBR });
    return `${day}, ${range}${where}`;
  }

  const days = differenceInCalendarDays(when.startsAt, now);
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  if (days === -1) return "Venceu ontem";
  if (days < 0) return `Venceu há ${-days} dias`;
  return `Vence em ${days} dias`;
}

/** O aviso mais urgente: o primeiro que ainda vai acontecer; sem nenhum, o que passou há menos tempo. */
export function pickAlert(alerts: SidebarAlert[], now = new Date()) {
  const sorted = [...alerts].sort((a, b) => parseISO(a.startsAt).getTime() - parseISO(b.startsAt).getTime());
  return sorted.find((alert) => parseISO(alert.startsAt).getTime() >= now.getTime()) ?? sorted.at(-1);
}
