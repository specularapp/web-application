"use client";

import { FireIcon, MedalIcon, TrendUpIcon, TrophyIcon, type Icon } from "@phosphor-icons/react";
import { format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { CSSProperties } from "react";
import { Text } from "@/components/ui/text";
import { ChallengeBlock } from "@/features/dashboard/components/challenge-block";
import { ClaimReward } from "@/features/dashboard/components/claim-reward";
import type { AiUsage } from "@/features/ai/summary";
import { SettingsPage, SettingsSection } from "@/features/settings/components/settings-page";
import settings from "@/features/settings/components/settings.module.css";
import type { PointsSummary, WeeklyChallenge } from "../summary";
import styles from "./achievements-screen.module.css";

export type AchievementsScreenProps = { points: PointsSummary; challenge: WeeklyChallenge; ai: AiUsage };

const number = new Intl.NumberFormat("pt-BR");

/** Quantos dias o histórico desenha: doze semanas, que é o que cabe numa linha por semana sem virar mural. */
const HISTORY_DAYS = 84;

type DayState = "met" | "partial" | "missed" | "upcoming";

/**
 * A página de conquistas (2026-09-17): os números da gamificação (pontos, posição, ritmo e sequência), o
 * arrasto do bônus do dia, a semana em curso, que é o mesmo bloco do painel, e o histórico de acesso das
 * últimas doze semanas, um quadradinho por dia. Tudo sai das duas leituras que o painel já faz; a página só
 * dá a elas o espaço que o painel não tem.
 */
export function AchievementsScreen({ points, challenge, ai }: AchievementsScreenProps) {
  const today = new Date();
  const byDay = new Map(challenge.history.map((day) => [day.date, day]));

  const stateOf = (iso: string): DayState => {
    const day = byDay.get(iso);
    if (parseISO(iso) > today) return "upcoming";
    if (!day || day.accesses === 0) return "missed";
    return day.onlineMinutes >= challenge.dailyGoalMinutes ? "met" : "partial";
  };

  /* Os últimos 84 dias, do mais antigo para hoje, alinhados em colunas de sete para a semana ler em coluna. */
  const days = Array.from({ length: HISTORY_DAYS }, (_, index) => format(subDays(today, HISTORY_DAYS - 1 - index), "yyyy-MM-dd"));
  const met = days.filter((iso) => stateOf(iso) === "met").length;

  const stats: { id: string; icon: Icon; hue: string; label: string; value: string; caption: string }[] = [
    { id: "points", icon: TrophyIcon, hue: "var(--sys-yellow)", label: "Pontos", value: number.format(points.points), caption: `${number.format(points.dailyPoints)} por dia no ritmo atual` },
    { id: "rank", icon: MedalIcon, hue: "var(--sys-indigo)", label: "Posição", value: `#${number.format(points.rank)}`, caption: "Entre todas as pessoas da Specular" },
    { id: "streak", icon: FireIcon, hue: "var(--sys-orange)", label: "Sequência", value: `${number.format(challenge.streakDays)} ${challenge.streakDays === 1 ? "dia" : "dias"}`, caption: `Desde ${format(parseISO(challenge.since), "d 'de' MMM. 'de' yyyy", { locale: ptBR })}` },
    { id: "met", icon: TrendUpIcon, hue: "var(--sys-green)", label: "Metas batidas", value: `${met} de ${HISTORY_DAYS}`, caption: `Dias com ${challenge.dailyGoalMinutes} min ou mais, nas últimas 12 semanas` },
  ];

  return (
    <SettingsPage ai={ai}>
      <div className={settings.cards} data-columns="3">
        {stats.map((stat) => (
          <article key={stat.id} className={settings.card}>
            <div className={settings.cardHead}>
              <span className={settings.glyph} style={{ "--item-hue": stat.hue } as CSSProperties} aria-hidden="true">
                <stat.icon weight="duotone" />
              </span>
              <div className={settings.cardCopy}>
                <Text as="span" variant="caption1" tone="secondary">
                  {stat.label}
                </Text>
                <Text as="span" variant="title2" weight="semibold">
                  {stat.value}
                </Text>
              </div>
            </div>
            <Text variant="footnote" tone="secondary">
              {stat.caption}
            </Text>
          </article>
        ))}
      </div>

      <SettingsSection title="Bônus do dia">
        <ClaimReward points={points.dailyBonus.points} claimed={points.dailyBonus.claimedToday} />
      </SettingsSection>

      <SettingsSection title="Esta semana">
        <ChallengeBlock challenge={challenge} />
      </SettingsSection>

      <SettingsSection title="Últimas doze semanas">
        <div className={styles.grid} role="img" aria-label={`${met} dias com a meta batida nas últimas doze semanas`}>
          {days.map((iso) => (
            <span key={iso} className={styles.day} data-state={stateOf(iso)} title={format(parseISO(iso), "EEEE, d 'de' MMMM", { locale: ptBR })} />
          ))}
        </div>
        <div className={styles.legend} aria-hidden="true">
          <span>
            <i className={styles.day} data-state="met" /> Meta batida
          </span>
          <span>
            <i className={styles.day} data-state="partial" /> Entrou
          </span>
          <span>
            <i className={styles.day} data-state="missed" /> Não entrou
          </span>
        </div>
      </SettingsSection>
    </SettingsPage>
  );
}
