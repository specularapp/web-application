import { DAY, groupOf, npsOf, themes } from "./labels";
import type { NpsClient, NpsData, NpsGroup, NpsResponse, NpsService } from "./types";

export type NpsPeriod = "30" | "90" | "180" | "365" | "all";

export type NpsFilters = { period: NpsPeriod; surveyId: string; service: NpsService | "all" };

export const defaultNpsFilters: NpsFilters = { period: "90", surveyId: "all", service: "all" };

export const periodLabels: Record<NpsPeriod, string> = {
  "30": "Últimos 30 dias",
  "90": "Últimos 90 dias",
  "180": "Últimos 6 meses",
  "365": "Últimos 12 meses",
  all: "Todo o período",
};

export type GroupShares = Record<NpsGroup, number>;

export type EvolutionPoint = { key: string; label: string; nps: number | null; count: number; counts: GroupShares; shares: GroupShares };

const monthShort = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "America/Sao_Paulo" });
const monthLong = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

export const monthKey = (iso: string) => iso.slice(0, 7);

function countsOf(rows: NpsResponse[]): GroupShares {
  const counts: GroupShares = { promoter: 0, passive: 0, detractor: 0 };
  for (const row of rows) counts[groupOf(row.score)] += 1;
  return counts;
}

function sharesOf(counts: GroupShares): GroupShares {
  const total = counts.promoter + counts.passive + counts.detractor;
  if (total === 0) return { promoter: 0, passive: 0, detractor: 0 };
  return { promoter: (counts.promoter / total) * 100, passive: (counts.passive / total) * 100, detractor: (counts.detractor / total) * 100 };
}

/** O recorte de um conjunto de respostas por pesquisa e serviço, sem o período. */
export function matchesFilters(response: NpsResponse, filters: NpsFilters, clientsById: Map<string, NpsClient>) {
  if (filters.surveyId !== "all" && response.surveyId !== filters.surveyId) return false;
  if (filters.service !== "all" && clientsById.get(response.clientId)?.project.service !== filters.service) return false;
  return true;
}

/** Tudo que o painel de resultados mostra, calculado na hora a partir das respostas e dos envios. */
export function buildDashboard(data: NpsData, filters: NpsFilters) {
  const now = Date.parse(data.now);
  const clientsById = new Map(data.clients.map((client) => [client.id, client]));
  const days = filters.period === "all" ? null : Number(filters.period);
  const since = days === null ? 0 : now - days * DAY;
  const before = days === null ? 0 : now - 2 * days * DAY;
  const scoped = data.responses.filter((response) => matchesFilters(response, filters, clientsById));
  const rows = scoped.filter((response) => Date.parse(response.answeredAt) >= since);
  const previous = days === null ? [] : scoped.filter((response) => Date.parse(response.answeredAt) >= before && Date.parse(response.answeredAt) < since);

  const counts = countsOf(rows);
  const nps = npsOf(rows.map((row) => row.score));
  const previousNps = npsOf(previous.map((row) => row.score));

  const distribution = Array.from({ length: 11 }, (_, index) => {
    const score = 10 - index;
    return { score, group: groupOf(score), count: rows.filter((row) => row.score === score).length };
  });

  const sends = data.sends.filter((send) => {
    if (send.status === "scheduled" || send.status === "cancelled" || !send.sentAt) return false;
    if (Date.parse(send.sentAt) < since) return false;
    if (filters.surveyId !== "all" && send.surveyId !== filters.surveyId) return false;
    if (filters.service !== "all" && clientsById.get(send.clientId)?.project.service !== filters.service) return false;
    return true;
  });
  const answered = sends.filter((send) => send.status === "answered").length;
  const withComment = rows.filter((row) => row.comment.trim()).length;
  const response = { sent: sends.length, answered, rate: sends.length > 0 ? (answered / sends.length) * 100 : 0, withComment, withoutComment: rows.length - withComment };

  const monthsBack = days === null || days > 180 ? 12 : 6;
  const end = new Date(now);
  const monthly: EvolutionPoint[] = Array.from({ length: monthsBack }, (_, index) => {
    const date = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (monthsBack - 1 - index), 15));
    const key = date.toISOString().slice(0, 7);
    const monthRows = scoped.filter((row) => monthKey(row.answeredAt) === key);
    const monthCounts = countsOf(monthRows);
    return { key, label: monthShort.format(date).replace(".", ""), nps: npsOf(monthRows.map((row) => row.score)), count: monthRows.length, counts: monthCounts, shares: sharesOf(monthCounts) };
  });

  const byService = (["site", "app", "branding", "ecommerce", "support"] as NpsService[])
    .map((service) => {
      const serviceRows = rows.filter((row) => clientsById.get(row.clientId)?.project.service === service);
      return { service, nps: npsOf(serviceRows.map((row) => row.score)), count: serviceRows.length, shares: sharesOf(countsOf(serviceRows)) };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => (b.nps ?? -999) - (a.nps ?? -999));

  const aspectOf = (list: NpsResponse[]) => {
    const totals = new Map<string, { sum: number; count: number }>();
    for (const row of list) {
      const survey = data.surveys.find((item) => item.id === row.surveyId);
      for (const question of survey?.questions ?? []) {
        const value = row.answers[question.id];
        if (question.kind !== "stars" || typeof value !== "number") continue;
        const entry = totals.get(question.aspect) ?? { sum: 0, count: 0 };
        entry.sum += value;
        entry.count += 1;
        totals.set(question.aspect, entry);
      }
    }
    return totals;
  };
  const aspectNow = aspectOf(rows);
  const aspectBefore = aspectOf(previous);
  const aspects = [...aspectNow.entries()]
    .map(([label, entry]) => {
      const past = aspectBefore.get(label);
      return { label, average: entry.sum / entry.count, count: entry.count, previous: past ? past.sum / past.count : null };
    })
    .sort((a, b) => b.count - a.count);

  const themeCounts = themes
    .map((theme) => {
      const touching = rows.filter((row) => row.themes.includes(theme.id));
      return { id: theme.id, label: theme.label, praise: touching.filter((row) => row.score >= 9).length, complaint: touching.filter((row) => row.score < 9).length };
    })
    .filter((theme) => theme.praise + theme.complaint > 0)
    .sort((a, b) => b.praise + b.complaint - (a.praise + a.complaint));

  const treatmentsInPeriod = data.treatments.filter((treatment) => rows.some((row) => row.id === treatment.responseId));
  const closedWithOutcome = treatmentsInPeriod.filter((treatment) => treatment.recovered !== null);

  return {
    total: rows.length,
    previousTotal: previous.length,
    counts,
    shares: sharesOf(counts),
    nps,
    previousNps,
    distribution,
    response,
    monthly,
    byService,
    aspects,
    themes: themeCounts,
    latest: rows.slice(0, 6),
    treatments: {
      open: treatmentsInPeriod.filter((treatment) => treatment.status !== "resolved" && treatment.status !== "noReply").length,
      late: treatmentsInPeriod.filter((treatment) => !treatment.firstContactAt && Date.parse(treatment.dueAt) < now).length,
      recovered: closedWithOutcome.filter((treatment) => treatment.recovered).length,
      closed: closedWithOutcome.length,
    },
  };
}

export type NpsDashboard = ReturnType<typeof buildDashboard>;

export const monthName = (key: string) => {
  const name = monthLong.format(new Date(`${key}-15T12:00:00Z`));
  return name.charAt(0).toUpperCase() + name.slice(1);
};

