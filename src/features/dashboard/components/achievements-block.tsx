import Image from "next/image";
import { Text } from "@/components/ui/text";
import type { PointsSummary } from "@/features/gamification/summary";
import { squircleAuto } from "@/lib/corners";
import styles from "./achievements-block.module.css";
import { ClaimSlider } from "./claim-slider";

export type AchievementsBlockProps = { summary: PointsSummary };

const number = new Intl.NumberFormat("pt-BR");

// O único bloco sem cabeçalho: um cartão de cor genérica com as quatro bolas de cor das quinas, na
// receita do container do plano. Dois containers: em cima, meio a meio, o adesivo holográfico da marca e
// os números (o total de pontos grande, e a posição no ranking e a geração diária em duas colunas);
// embaixo, de ponta a ponta, o arrasto que dá os pontos do dia, uma vez por dia. É a cara da
// gamificação no painel.
export function AchievementsBlock({ summary }: AchievementsBlockProps) {
  return (
    <section className={styles.block} aria-label="Conquistas" {...squircleAuto({ clip: true })}>
      <div className={styles.top}>
        <div className={styles.art}>
          <Image src="/bg/logo-gamification.png" alt="" width={415} height={414} className={styles.sticker} priority />
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

      <ClaimSlider points={summary.dailyBonus.points} claimed={summary.dailyBonus.claimedToday} />
    </section>
  );
}
