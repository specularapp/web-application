import { addDays, addHours, differenceInCalendarDays, format, isSameDay, parseISO, roundToNearestMinutes } from "date-fns";
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

function buildPreview(now: Date): SidebarAlert[] {
  const meetingStart = roundToNearestMinutes(addHours(now, 2), { nearestTo: 30 });
  const meetingEnd = addHours(meetingStart, 0.5);
  const delivery = addDays(now, 2);
  const invoice = addDays(now, 1);

  return [
    {
      id: "reuniao-aurora",
      kind: "meeting",
      title: "Alinhamento com a Padaria Aurora",
      detail: describeAlert("meeting", { startsAt: meetingStart, endsAt: meetingEnd, channel: "Zoom" }, now),
      startsAt: meetingStart.toISOString(),
      people: [
        { name: "Marina Duarte", avatarUrl: null },
        { name: "Aleph Ramos", avatarUrl: null },
        { name: "Arthur Gomes", avatarUrl: null },
        { name: "Carla Mendes", avatarUrl: null },
        { name: "Ana Freitas", avatarUrl: null },
        { name: "Bruno Sales", avatarUrl: null },
        { name: "Elisa Martins", avatarUrl: null },
      ],
      action: { label: "Entrar agora", href: "https://zoom.us" },
    },
    {
      id: "entrega-site",
      kind: "delivery",
      title: "Entrega do site institucional",
      detail: describeAlert("delivery", { startsAt: delivery }, now),
      startsAt: delivery.toISOString(),
      people: [
        { name: "Camila Ferreira", avatarUrl: null },
        { name: "Aleph Ramos", avatarUrl: null },
      ],
      action: { label: "Ver projeto", href: "/projetos" },
    },
    {
      id: "cobranca-bravo",
      kind: "invoice",
      title: "Cobrança do Estúdio Bravo",
      detail: describeAlert("invoice", { startsAt: invoice }, now),
      startsAt: invoice.toISOString(),
      people: [{ name: "Rafael Nunes", avatarUrl: null }],
      action: { label: "Ver cobrança", href: "/cobrancas" },
    },
  ];
}

/**
 * Avisos de exemplo enquanto reuniões, entregas e cobranças não existem no banco: relativos a agora,
 * para a prévia não envelhecer, e com a linha de apoio já escrita no servidor, para não divergir na
 * hidratação. Quem montar as tabelas troca só a origem.
 */
export const previewAlerts = buildPreview(new Date());
