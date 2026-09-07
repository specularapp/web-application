import { addDays, format, getISODay, isAfter, isSameDay, startOfWeek, subDays } from "date-fns";
import type { ChallengeDay, PointsSummary, WeeklyChallenge } from "./summary";

const STREAK_DAYS = 142;
const GOAL_MINUTES = 30;

/* O uso dos últimos sete dias, por dia da semana (segunda primeiro), para a semana em curso ler bem. */
const recentUsage = [
  { accesses: 4, onlineMinutes: 96 },
  { accesses: 6, onlineMinutes: 142 },
  { accesses: 2, onlineMinutes: 18 },
  { accesses: 3, onlineMinutes: 47 },
  { accesses: 1, onlineMinutes: 12 },
  { accesses: 1, onlineMinutes: 22 },
  { accesses: 3, onlineMinutes: 80 },
];

const key = (date: Date) => format(date, "yyyy-MM-dd");

/**
 * Histórico de exemplo enquanto o domínio não existe no banco: um dia para cada dia da sequência, do
 * primeiro acesso até hoje. Hoje já bate a meta, para o check de hoje aparecer; a última semana segue o
 * uso fixo por dia da semana; e o resto vem de um padrão determinístico, com uns dias abaixo da meta,
 * para o calendário ter dias parciais. Relativo a hoje, para a prévia não envelhecer.
 */
function buildHistory(): ChallengeDay[] {
  const today = new Date();

  return Array.from({ length: STREAK_DAYS }, (_, index) => {
    const ago = STREAK_DAYS - 1 - index;
    const date = subDays(today, ago);
    if (ago === 0) return { date: key(date), accesses: 3, onlineMinutes: 34 };
    if (ago <= 6) return { date: key(date), ...(recentUsage[getISODay(date) - 1] ?? recentUsage[0]) };
    const seed = (ago * 7919) % 101;
    const partial = seed < 14;
    return { date: key(date), accesses: 1 + (seed % 6), onlineMinutes: partial ? 8 + seed : GOAL_MINUTES + (seed % 90) };
  });
}

const history = buildHistory();
const byDate = new Map(history.map((day) => [day.date, day]));

/** A semana em curso, de segunda a domingo, lida do histórico; os dias que ainda vêm ficam zerados. */
function buildWeek(): ChallengeDay[] {
  const today = new Date();
  const monday = startOfWeek(today, { weekStartsOn: 1 });

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    if (isAfter(date, today) && !isSameDay(date, today)) return { date: key(date), accesses: 0, onlineMinutes: 0 };
    return byDate.get(key(date)) ?? { date: key(date), accesses: 0, onlineMinutes: 0 };
  });
}

export const previewPointsSummary: PointsSummary = {
  points: 1_590,
  rank: 3_329,
  dailyPoints: 30,
  dailyBonus: { points: 50, claimedToday: false },
};

export const previewWeeklyChallenge: WeeklyChallenge = {
  streakDays: STREAK_DAYS,
  // Quem tem 142 dias seguidos e nunca falhou começou 141 dias atrás.
  since: format(subDays(new Date(), STREAK_DAYS - 1), "yyyy-MM-dd"),
  days: buildWeek(),
  history,
  dailyGoalMinutes: GOAL_MINUTES,
};
