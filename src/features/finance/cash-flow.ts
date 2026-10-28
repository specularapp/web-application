import type { FinanceCategory, InstallmentEntry } from "./installments";
import type { CashFlowData, MovementEntry } from "./movements";
import type { ChargeMethod } from "./summary";

/*
 * As contas do fluxo de caixa (2026-10-27, fase 5 da vinda do financeiro da Le Ange): o período e o anterior de
 * mesmo tamanho, os baldes do gráfico, os números, a projeção do saldo e os rankings. Puro, sem tela nem banco,
 * porque a tela refaz tudo a cada troca de período ou de conta sem voltar ao servidor.
 */

export type CashPeriod = "mes" | "30" | "90" | "ano" | "12m";

export const cashPeriods: Record<CashPeriod, string> = {
  mes: "Este mês",
  "30": "Últimos 30 dias",
  "90": "Últimos 90 dias",
  ano: "Este ano",
  "12m": "Últimos 12 meses",
};

const DAY = 86_400_000;

const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (time: number) => new Date(time).toISOString().slice(0, 10);
export const addDays = (iso: string, days: number) => toIso(toTime(iso) + days * DAY);
const daysBetween = (from: string, to: string) => Math.round((toTime(to) - toTime(from)) / DAY);

const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const shortDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const shortMonth = (iso: string, year: string) => `${monthNames[Number(iso.slice(5, 7)) - 1]}${iso.slice(0, 4) === year ? "" : ` ${iso.slice(2, 4)}`}`;

export type Range = { from: string; to: string; days: number };

/** O período escolhido, terminando hoje (ou no fim do mês e do ano, que começam no dia 1). */
export function rangeOf(period: CashPeriod, today: string): Range {
  const from =
    period === "mes"
      ? `${today.slice(0, 7)}-01`
      : period === "ano"
        ? `${today.slice(0, 4)}-01-01`
        : period === "12m"
          ? `${String(Number(today.slice(0, 4)) - 1)}-${today.slice(5, 7)}-01`
          : addDays(today, -(Number(period) - 1));
  return { from, to: today, days: daysBetween(from, today) + 1 };
}

/** O período anterior, de mesmo tamanho, terminando na véspera do atual: é contra ele que os números comparam. */
export const previousOf = (range: Range): Range => ({ from: addDays(range.from, -range.days), to: addDays(range.from, -1), days: range.days });

export type Bucket = { key: string; label: string; from: string; to: string };

/** Os baldes do gráfico: por dia até um mês, por semana até três meses, por mês no resto. */
export function bucketsOf(range: Range): Bucket[] {
  const buckets: Bucket[] = [];
  if (range.days <= 31) {
    for (let at = range.from; at <= range.to; at = addDays(at, 1)) buckets.push({ key: at, label: shortDay(at), from: at, to: at });
    return buckets;
  }
  if (range.days <= 92) {
    for (let at = range.from; at <= range.to; at = addDays(at, 7)) {
      const end = addDays(at, 6) < range.to ? addDays(at, 6) : range.to;
      buckets.push({ key: at, label: shortDay(at), from: at, to: end });
    }
    return buckets;
  }
  let month = `${range.from.slice(0, 7)}-01`;
  while (month <= range.to) {
    const next = Number(month.slice(5, 7)) === 12 ? `${Number(month.slice(0, 4)) + 1}-01-01` : `${month.slice(0, 5)}${String(Number(month.slice(5, 7)) + 1).padStart(2, "0")}-01`;
    const end = addDays(next, -1) < range.to ? addDays(next, -1) : range.to;
    buckets.push({ key: month, label: shortMonth(month, range.to.slice(0, 4)), from: month < range.from ? range.from : month, to: end });
    month = next;
  }
  return buckets;
}

export type FlowPoint = { key: string; label: string; income: number; expense: number; result: number; countIn: number; countOut: number; balance: number };
export type ProjectionPoint = { date: string; label: string; balance: number };
export type RankItem = { id: string; label: string; amount: number; hue?: string; method?: ChargeMethod };
export type Totals = { inflow: number; outflow: number; result: number; countIn: number; countOut: number };

export type CashFlowReport = {
  range: Range;
  totals: Totals;
  previous: Totals;
  balance: number;
  series: FlowPoint[];
  receivable30: number;
  payable30: number;
  receivableCount30: number;
  payableCount30: number;
  /** Quanto do que está por receber ainda não venceu, de 0 a 1; nulo sem nada por receber. */
  receivableOnTime: number | null;
  payableOnTime: number | null;
  projection: ProjectionPoint[];
  projectionAt: { days: number; balance: number }[];
  lowest: ProjectionPoint | null;
  outByCategory: RankItem[];
  inByCategory: RankItem[];
  outByParty: RankItem[];
  inByMethod: RankItem[];
  overdue: InstallmentEntry[];
  upcoming: InstallmentEntry[];
  movements: MovementEntry[];
};

const signed = (entry: MovementEntry) => (entry.kind === "income" ? entry.amount : -entry.amount);

function totalsOf(entries: MovementEntry[]): Totals {
  const income = entries.filter((entry) => entry.kind === "income");
  const expense = entries.filter((entry) => entry.kind === "expense");
  const inflow = income.reduce((sum, entry) => sum + entry.amount, 0);
  const outflow = expense.reduce((sum, entry) => sum + entry.amount, 0);
  return { inflow, outflow, result: inflow - outflow, countIn: income.length, countOut: expense.length };
}

function rank<T>(entries: T[], keyOf: (entry: T) => { id: string; label: string; hue?: string; method?: ChargeMethod }, amountOf: (entry: T) => number): RankItem[] {
  const map = new Map<string, RankItem>();
  for (const entry of entries) {
    const key = keyOf(entry);
    const found = map.get(key.id);
    if (found) found.amount += amountOf(entry);
    else map.set(key.id, { ...key, amount: amountOf(entry) });
  }
  return [...map.values()].toSorted((a, b) => b.amount - a.amount);
}

/** Quantos dias a projeção do saldo cobre, e os marcos que ela anuncia. */
export const PROJECTION_DAYS = 90;
const MILESTONES = [30, 60, 90];

/**
 * O relatório do período para uma conta (ou todas). O saldo de cada balde é o saldo de hoje menos o que entrou e
 * saiu depois dele; a projeção parte do saldo de hoje e soma o que vence a receber e subtrai o que vence a pagar,
 * com o que está atrasado contando como hoje, como na Le Ange.
 */
export function cashFlowReport(data: CashFlowData, period: CashPeriod, accountId: string | null): CashFlowReport {
  const { today } = data;
  const range = rangeOf(period, today);
  const previousRange = previousOf(range);
  const defaultAccount = data.accounts.find((account) => account.isDefault)?.id ?? null;

  const ofAccount = (id: string | null) => !accountId || (id ?? defaultAccount) === accountId;
  const movements = data.movements.filter((entry) => ofAccount(entry.accountId));
  const dues = data.dues.filter((entry) => ofAccount(entry.accountId));
  const accounts = data.accounts.filter((account) => account.active && (!accountId || account.id === accountId));
  const balance = accounts.reduce((sum, account) => sum + account.balance, 0);

  const within = (entry: MovementEntry, from: string, to: string) => entry.date >= from && entry.date <= to;
  const inRange = movements.filter((entry) => within(entry, range.from, range.to));
  const inPrevious = movements.filter((entry) => within(entry, previousRange.from, previousRange.to));

  const series = bucketsOf(range).map((bucket) => {
    const own = totalsOf(inRange.filter((entry) => within(entry, bucket.from, bucket.to)));
    const after = movements.filter((entry) => entry.date > bucket.to).reduce((sum, entry) => sum + signed(entry), 0);
    return { key: bucket.key, label: bucket.label, income: own.inflow, expense: own.outflow, result: own.result, countIn: own.countIn, countOut: own.countOut, balance: balance - after };
  });

  const receivables = dues.filter((entry) => entry.direction === "incoming");
  const payables = dues.filter((entry) => entry.direction === "outgoing");
  const limit30 = addDays(today, 30);
  const soon = (entry: InstallmentEntry) => entry.dueDate <= limit30;
  const sum = (entries: InstallmentEntry[]) => entries.reduce((total, entry) => total + entry.amount, 0);
  const onTime = (entries: InstallmentEntry[]) => {
    const total = sum(entries);
    return total === 0 ? null : sum(entries.filter((entry) => entry.status !== "overdue")) / total;
  };

  // A projeção: dia a dia, de hoje a 90 dias, o atrasado entrando hoje
  const projection: ProjectionPoint[] = [];
  let running = balance;
  for (let offset = 0; offset <= PROJECTION_DAYS; offset += 1) {
    const day = addDays(today, offset);
    const due = dues.filter((entry) => (offset === 0 ? entry.dueDate <= day : entry.dueDate === day));
    running += due.reduce((total, entry) => total + (entry.direction === "incoming" ? entry.amount : -entry.amount), 0);
    projection.push({ date: day, label: shortDay(day), balance: running });
  }
  const lowest = projection.reduce<ProjectionPoint | null>((min, point) => (!min || point.balance < min.balance ? point : min), null);

  const categoryOf = (id: string | null): FinanceCategory | null => data.categories.find((category) => category.id === id) ?? null;
  const categoryKey = (entry: MovementEntry) => {
    const category = categoryOf(entry.categoryId);
    return category ? { id: category.id, label: category.name, hue: category.hue } : { id: "none", label: "Sem categoria", hue: "gray" };
  };
  const income = inRange.filter((entry) => entry.kind === "income");
  const expense = inRange.filter((entry) => entry.kind === "expense");

  return {
    range,
    totals: totalsOf(inRange),
    previous: totalsOf(inPrevious),
    balance,
    series,
    receivable30: sum(receivables.filter(soon)),
    payable30: sum(payables.filter(soon)),
    receivableCount30: receivables.filter(soon).length,
    payableCount30: payables.filter(soon).length,
    receivableOnTime: onTime(receivables),
    payableOnTime: onTime(payables),
    projection,
    projectionAt: MILESTONES.map((days) => ({ days, balance: projection[days]?.balance ?? running })),
    lowest,
    outByCategory: rank(expense, categoryKey, (entry) => entry.amount),
    inByCategory: rank(income, categoryKey, (entry) => entry.amount),
    outByParty: rank(expense, (entry) => ({ id: entry.title, label: entry.title }), (entry) => entry.amount),
    inByMethod: rank(
      income,
      (entry) => ({ id: entry.method ?? "none", label: entry.method ?? "none", method: entry.method ?? undefined }),
      (entry) => entry.amount,
    ),
    overdue: dues.filter((entry) => entry.status === "overdue").toSorted((a, b) => a.dueDate.localeCompare(b.dueDate)),
    upcoming: dues.filter((entry) => entry.status === "open" && soon(entry)).toSorted((a, b) => a.dueDate.localeCompare(b.dueDate)),
    movements: inRange,
  };
}

/** A variação contra o período anterior, em fração; nula quando o anterior foi zero, que não tem base. */
export const changeOf = (current: number, previous: number) => (previous === 0 ? null : (current - previous) / Math.abs(previous));
