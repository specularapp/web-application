import { CheckCircleIcon, CircleIcon } from "@phosphor-icons/react/ssr";
import Image from "next/image";
import { useId } from "react";
import { Text } from "@/components/ui/text";
import { dailyMissions } from "@/features/gamification/missions";
import type { PointsSummary, WeeklyChallenge } from "@/features/gamification/summary";
import { roundedAuto } from "@/lib/corners";
import styles from "./achievements-block.module.css";
import { ClaimReward } from "./claim-reward";

export type AchievementsBlockProps = { summary: PointsSummary; challenge: WeeklyChallenge };

const number = new Intl.NumberFormat("pt-BR");

// O único bloco sem cabeçalho, no fundo padrão dos cartões. Dois containers: em cima, meio a meio, o adesivo holográfico da marca e
// os números (o total de pontos grande, e a posição no ranking e a geração diária em duas colunas); no
// meio, as três missões de hoje, cada uma com o check de feita; embaixo, de ponta a ponta, o arrasto que dá
// os pontos do dia, uma vez por dia, com a comemoração ao chegar. É a cara da gamificação no painel, e
// ocupa o lugar alto que era dos projetos (2026-10-25, a pedido).
export function AchievementsBlock({ summary, challenge }: AchievementsBlockProps) {
  const missionsId = useId();
  const missions = dailyMissions(summary, challenge);
  const pending = missions.filter((mission) => !mission.done).length;

  return (
    <section className={styles.block} aria-label="Conquistas" {...roundedAuto({ clip: true })}>
      <div className={styles.top}>
        <div className={styles.art}>
          <Image src="/bg/logo-gamification.png" alt="" width={415} height={414} sizes="96px" className={styles.sticker} priority />
        </div>

        <div className={styles.numbers}>
          <p className={styles.total}>
            <Text as="span" variant="title1" weight="semibold">
              {number.format(summary.points)}
            </Text>
            <Text as="span" variant="subheadline" tone="secondary">
              pontos
            </Text>
          </p>
          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>Ranking</dt>
              <dd>#{number.format(summary.rank)}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Por dia</dt>
              <dd>{number.format(summary.dailyPoints)} pts</dd>
            </div>
          </dl>
        </div>
      </div>

      <section className={styles.missions} aria-labelledby={missionsId}>
        <div className={styles.missionsHead}>
          <Text as="h3" id={missionsId} variant="caption1" weight="medium" tone="secondary">
            Missões de hoje
          </Text>
          <Text as="span" variant="caption1" tone="secondary" numeric>
            {pending === 0 ? "Todas feitas" : `${pending} pendente${pending === 1 ? "" : "s"}`}
          </Text>
        </div>
        <ul className={styles.missionList}>
          {missions.map((mission) => (
            <li key={mission.id} className={styles.mission} data-done={mission.done || undefined}>
              {mission.done ? (
                <CheckCircleIcon weight="fill" className={styles.check} aria-hidden="true" />
              ) : (
                <CircleIcon className={styles.check} aria-hidden="true" />
              )}
              <Text as="span" variant="footnote" weight="medium" truncate className={styles.missionTitle}>
                {mission.title}
              </Text>
              <Text as="span" variant="caption1" tone="secondary" numeric className={styles.missionProgress}>
                {mission.done ? "Feita" : mission.progress}
              </Text>
            </li>
          ))}
        </ul>
      </section>

      <ClaimReward points={summary.dailyBonus.points} claimed={summary.dailyBonus.claimedToday} />
    </section>
  );
}
