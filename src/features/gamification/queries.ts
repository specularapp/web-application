import "server-only";
import { getOrganizationContext } from "@/features/organizations/context";
import { DAILY_BONUS_POINTS, DAILY_GOAL_MINUTES, getPointsSummary, getWeeklyChallenge, recordAccess } from "./service";
import type { PointsSummary, WeeklyChallenge } from "./summary";

const EMPTY_POINTS: PointsSummary = {
  points: 0,
  rank: 1,
  dailyPoints: 0,
  dailyBonus: { points: DAILY_BONUS_POINTS, claimedToday: false },
};

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_CHALLENGE: WeeklyChallenge = {
  streakDays: 0,
  since: today(),
  days: [],
  history: [],
  dailyGoalMinutes: DAILY_GOAL_MINUTES,
};

/**
 * Os dois blocos do painel de uma vez. Abrir o painel é a entrada do dia, então é aqui que ela é
 * registrada: a contagem nasce da leitura da própria tela, e não de uma chamada que a tela poderia repetir.
 */
export async function getGamificationBlocks(): Promise<{ points: PointsSummary; challenge: WeeklyChallenge }> {
  const context = await getOrganizationContext();
  if (!context) return { points: EMPTY_POINTS, challenge: EMPTY_CHALLENGE };

  await recordAccess(context.supabase).catch(() => undefined);

  const [points, challenge] = await Promise.all([
    getPointsSummary(context.supabase),
    getWeeklyChallenge(context.supabase),
  ]);

  return { points, challenge };
}
