import { Skeleton } from "@/components/ui/skeleton";
import { rounded } from "@/lib/corners";
import { AiMark } from "./ai-mark";
import styles from "./ai-workspace-skeleton.module.css";

/**
 * O esqueleto da página do SpeculAI, com as medidas da tela de verdade: o histórico à esquerda e, no meio, a
 * abertura com a marca, a saudação e o compositor. A marca já entra pronta, porque é desenho e não dado.
 */
export function AiWorkspaceSkeleton() {
  return (
    <div className={styles.screen}>
      <span role="status" aria-live="polite" className={styles.status}>
        Abrindo o SpeculAI
      </span>

      <div className={styles.rail}>
        <div className={styles.railHead}>
          <Skeleton shape="rect" width="100%" height="2rem" />
          <Skeleton shape="rect" width="2rem" height="2rem" />
        </div>
        <Skeleton shape="rect" width="100%" height="2rem" />
        <div className={styles.railList}>
          <Skeleton width="4rem" height="0.75rem" />
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} width={`${88 - index * 7}%`} height="0.875rem" />
          ))}
        </div>
      </div>

      <div className={styles.main}>
        <div className={styles.column}>
          <span className={styles.mark}>
            <AiMark size={56} />
          </span>
          <Skeleton width="min(22rem, 80%)" height="2rem" />
          <Skeleton width="min(28rem, 90%)" height="0.875rem" />
          <div className={styles.composer} {...rounded("2xl")}>
            <Skeleton width="40%" height="1rem" />
            <div className={styles.composerFoot}>
              <Skeleton shape="circle" width="2rem" height="2rem" />
              <Skeleton shape="rect" width="5rem" height="1.5rem" />
              <span className={styles.spacer} />
              <Skeleton shape="circle" width="2rem" height="2rem" />
            </div>
          </div>
          <div className={styles.starters}>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} shape="rect" width="100%" height="4.25rem" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
