import type { PointsSummary, WeeklyChallenge } from "./summary";

export type MissionId = "daily-bonus" | "online-goal" | "streak";

export type Mission = {
  id: MissionId;
  title: string;
  /** O quanto já foi feito, em texto curto: "12 de 30 min", "3 de 7 dias". */
  progress: string;
  done: boolean;
};

/** Dias seguidos para a missão de sequência valer. */
export const STREAK_MISSION_DAYS = 7;

/**
 * As três missões do bloco de conquistas (2026-10-25, a pedido), tiradas do que a gamificação já registra:
 * o bônus do dia, a meta de tempo online de hoje e a sequência da semana. Não há tabela de missões, então
 * nenhuma delas pode marcar sozinha: cada uma é a leitura de um dado que já existe no banco.
 */
export function dailyMissions(points: PointsSummary, challenge: WeeklyChallenge): Mission[] {
  const todayMinutes = challenge.history.at(-1)?.onlineMinutes ?? 0;
  const goal = challenge.dailyGoalMinutes;
  const streak = Math.min(challenge.streakDays, STREAK_MISSION_DAYS);

  return [
    {
      id: "daily-bonus",
      title: "Resgatar o bônus do dia",
      progress: `${points.dailyBonus.points} pts`,
      done: points.dailyBonus.claimedToday,
    },
    {
      id: "online-goal",
      title: `Ficar ${goal} min online hoje`,
      progress: `${Math.min(todayMinutes, goal)} de ${goal} min`,
      done: todayMinutes >= goal,
    },
    {
      id: "streak",
      title: `Entrar ${STREAK_MISSION_DAYS} dias seguidos`,
      progress: `${streak} de ${STREAK_MISSION_DAYS} dias`,
      done: challenge.streakDays >= STREAK_MISSION_DAYS,
    },
  ];
}
