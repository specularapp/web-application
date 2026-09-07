import { addDays, format, isAfter, isSameDay, startOfWeek } from "date-fns";
import type { ChallengeDay, WeeklyChallenge } from "./summary";

const pastDays = [
  { accesses: 4, onlineMinutes: 96 },
  { accesses: 6, onlineMinutes: 142 },
  { accesses: 2, onlineMinutes: 18 },
  { accesses: 3, onlineMinutes: 27 },
  { accesses: 1, onlineMinutes: 12 },
  { accesses: 1, onlineMinutes: 22 },
  { accesses: 3, onlineMinutes: 80 },
];

/**
 * Semana de exemplo enquanto o domínio não existe no banco: os dias já passados ganham uso, o de hoje
 * ganha um começo de uso e os que ainda vêm ficam zerados. Relativa a hoje, para a prévia não
 * envelhecer. Quem montar a tabela troca só a origem.
 */
function buildWeek(): ChallengeDay[] {
  const today = new Date();
  const monday = startOfWeek(today, { weekStartsOn: 1 });

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    const usage = pastDays[index] ?? pastDays[0];
    if (isAfter(date, today) && !isSameDay(date, today)) return { date: format(date, "yyyy-MM-dd"), accesses: 0, onlineMinutes: 0 };
    if (isSameDay(date, today)) return { date: format(date, "yyyy-MM-dd"), accesses: 2, onlineMinutes: 14 };
    return { date: format(date, "yyyy-MM-dd"), ...usage };
  });
}

export const previewWeeklyChallenge: WeeklyChallenge = {
  days: buildWeek(),
  dailyGoalMinutes: 30,
  percentile: 92,
};
