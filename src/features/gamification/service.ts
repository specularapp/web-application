import "server-only";
import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ChallengeDay, PointsSummary, WeeklyChallenge } from "./summary";

/**
 * A gamificação contra o banco: os pontos de quem usa e o dia a dia de acesso de que sai o desafio da
 * semana. Contagem de acesso feita pela tela seria contagem que a tela pode inventar, então quem escreve é
 * a função do banco, e a leitura da posição no ranking também, para ninguém precisar ler a ficha alheia.
 */
export type GamificationClient = SupabaseClient<Database>;

/** Minutos online por dia para o dia contar como batido (decisão de produto de 2026-09-07). */
export const DAILY_GOAL_MINUTES = 30;

/** Quantos pontos o arrasto do dia vale. */
export const DAILY_BONUS_POINTS = 25;

const isoDate = (date: Date) => format(date, "yyyy-MM-dd");

/** Registra a entrada do dia e soma os minutos online. */
export async function recordAccess(client: GamificationClient, minutes = 0) {
  await client.rpc("record_access", { p_minutes: minutes });
}

export async function claimDailyBonus(client: GamificationClient) {
  const { data } = await client.rpc("claim_daily_bonus", { p_points: DAILY_BONUS_POINTS });
  return Boolean(data);
}

export async function getPointsSummary(client: GamificationClient): Promise<PointsSummary> {
  const { data } = await client.rpc("gamification_summary");
  const row = data?.[0];

  return {
    points: row?.points ?? 0,
    rank: row?.rank ?? 1,
    dailyPoints: row?.daily_points ?? 0,
    dailyBonus: { points: DAILY_BONUS_POINTS, claimedToday: row?.bonus_claimed_today ?? false },
  };
}

/**
 * O desafio da semana: a sequência de dias seguidos em que a pessoa entrou, os sete dias da semana em curso
 * e o histórico desde o primeiro acesso. Dia sem linha no banco é dia sem acesso, e entra zerado, para a
 * trilha não ter buraco.
 */
export async function getWeeklyChallenge(client: GamificationClient): Promise<WeeklyChallenge> {
  const [{ data: profile }, { data: days }] = await Promise.all([
    client.from("gamification_profiles").select("since").maybeSingle(),
    client.from("gamification_days").select("day, accesses, online_minutes").order("day"),
  ]);

  const today = new Date();
  const since = profile?.since ?? isoDate(today);
  const byDay = new Map((days ?? []).map((row) => [row.day, row]));

  const dayOf = (date: Date): ChallengeDay => {
    const key = isoDate(date);
    const row = byDay.get(key);
    return { date: key, accesses: row?.accesses ?? 0, onlineMinutes: row?.online_minutes ?? 0 };
  };

  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const week = Array.from({ length: 7 }, (_, index) => dayOf(addDays(weekStart, index)));

  const span = Math.max(0, differenceInCalendarDays(today, parseISO(since)));
  const history = Array.from({ length: span + 1 }, (_, index) => dayOf(addDays(parseISO(since), index)));

  /* A sequência conta de trás para frente, a partir de hoje: hoje só entra se já houve acesso, para a
     contagem não subir sozinha à meia-noite. */
  let streakDays = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index]!.accesses === 0) break;
    streakDays += 1;
  }

  return { streakDays, since, days: week, history, dailyGoalMinutes: DAILY_GOAL_MINUTES };
}
