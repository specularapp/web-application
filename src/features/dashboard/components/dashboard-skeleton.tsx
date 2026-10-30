import type { CSSProperties } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardBlocks } from "../blocks";
import grid from "./dashboard-grid.module.css";
import screen from "./dashboard-screen.module.css";
import styles from "./dashboard-skeleton.module.css";

/**
 * O esqueleto do painel (2026-10-29, a pedido: "faça refletir o que será exibido certinho em cada página"): o
 * cabeçalho com o rosto, o nome e a saudação, o período, o personalizar e a ação, e a mesma grade de blocos do
 * painel, cada bloco na área dele (`data-block`), com o título e as linhas no lugar do conteúdo. Segue o arranjo
 * padrão; quem mexeu no arranjo vê os blocos se acomodarem quando o painel chega.
 */
export function DashboardSkeleton() {
  return (
    <div className={screen.screen}>
      <span role="status" aria-live="polite" className={styles.status}>
        Carregando o painel
      </span>

      <div className={styles.header}>
        <Skeleton shape="circle" width="2.5rem" height="2.5rem" />
        <div className={styles.copy}>
          <Skeleton width="9rem" height="1rem" />
          <Skeleton width="13rem" height="0.6875rem" />
        </div>
        <Skeleton shape="rect" className={styles.square} />
        <Skeleton shape="rect" className={styles.square} />
        <Skeleton shape="rect" className={styles.action} />
      </div>

      <div className={grid.grid}>
        {dashboardBlocks.map((block, index) => (
          <div key={block.id} className={styles.block} data-block={block.id} style={{ "--index": index } as CSSProperties}>
            <div className={styles.blockHead}>
              <Skeleton shape="rect" width="1.25rem" height="1.25rem" />
              <Skeleton width="7rem" height="0.875rem" />
              <span className={styles.spacer} />
              {block.action && <Skeleton shape="rect" width="5.5rem" height="1.75rem" />}
            </div>
            <div className={styles.lines}>
              <Skeleton width="45%" height="1.375rem" />
              <Skeleton width="88%" height="0.6875rem" />
              <Skeleton width="72%" height="0.6875rem" />
              <Skeleton width="80%" height="0.6875rem" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
