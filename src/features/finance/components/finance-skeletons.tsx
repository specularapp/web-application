import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./finance-skeletons.module.css";

/**
 * Os esqueletos das telas do financeiro que não são lista (2026-10-29, a pedido: "faça refletir o que será
 * exibido certinho em cada página"): o fluxo de caixa e as contas bancárias, no desenho de cada uma, dentro da
 * moldura e da barra do `PageSkeleton`.
 */

/** O fluxo de caixa: o destaque do resultado com os medidores, os oito números com a curva e os gráficos. */
export function CashFlowSkeleton() {
  return (
    <PageSkeleton label="Carregando o fluxo de caixa" toolbar={{ search: false, selects: 2, outlines: 1, action: true }}>
      <div className={styles.flow}>
        <div className={styles.highlight}>
          <div className={styles.result}>
            <Skeleton width="8rem" height="0.6875rem" />
            <Skeleton width="13rem" height="2rem" />
            <div className={styles.line}>
              <Skeleton width="7rem" height="0.6875rem" />
              <Skeleton width="6rem" height="0.6875rem" />
              <Skeleton width="5rem" height="0.6875rem" />
            </div>
            <Skeleton shape="rect" className={styles.bar} />
          </div>
          <div className={styles.gauges}>
            {[0, 1].map((index) => (
              <div key={index} className={styles.gauge}>
                <Skeleton width="7rem" height="0.6875rem" />
                <Skeleton width="3.5rem" height="1.125rem" />
                <Skeleton shape="rect" className={styles.bar} />
              </div>
            ))}
          </div>
        </div>

        <div className={styles.kpis}>
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className={styles.kpi}>
              <Skeleton width="5rem" height="0.6875rem" />
              <Skeleton width={index % 3 === 1 ? "4rem" : "8rem"} height="1.25rem" />
              {index >= 3 && <Skeleton width="6rem" height="0.625rem" />}
              {index < 6 && <Skeleton shape="rect" className={styles.spark} />}
            </div>
          ))}
        </div>

        <div className={styles.pair}>
          {[0, 1].map((index) => (
            <div key={index} className={styles.chart}>
              <Skeleton width="8rem" height="0.875rem" />
              <Skeleton shape="rect" className={styles.plot} />
            </div>
          ))}
        </div>
      </div>
    </PageSkeleton>
  );
}

/** As contas bancárias: os cartões com a face no véu, o saldo e a curva, os detalhes e os dois botões. */
export function AccountsSkeleton() {
  return (
    <PageSkeleton label="Carregando as contas bancárias" toolbar={{ search: true, filter: true, view: true, outlines: 1, action: true }}>
      <div className={styles.accounts}>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={styles.account}>
            <div className={styles.face}>
              <div className={styles.line}>
                <Skeleton shape="rect" width="2.5rem" height="2.5rem" />
                <div className={styles.stack}>
                  <Skeleton width="7rem" height="0.875rem" />
                  <Skeleton width="4.5rem" height="0.625rem" />
                </div>
                <Skeleton shape="rect" width="1.5rem" height="1.5rem" />
              </div>
              <div className={styles.stack}>
                <Skeleton width="4.5rem" height="0.625rem" />
                <Skeleton width="10rem" height="1.75rem" />
              </div>
              <Skeleton shape="rect" className={styles.curve} />
            </div>
            <div className={styles.details}>
              <div className={styles.line}>
                <Skeleton shape="rect" className={styles.pill} width="6rem" />
                <Skeleton shape="rect" className={styles.pill} width="3.5rem" />
                <span className={styles.spacer} />
                <Skeleton width="6rem" height="0.6875rem" />
              </div>
              <div className={styles.halves}>
                {[0, 1].map((half) => (
                  <div key={half} className={styles.line}>
                    <Skeleton shape="rect" width="1.75rem" height="1.75rem" />
                    <div className={styles.stack}>
                      <Skeleton width="5.5rem" height="0.625rem" />
                      <Skeleton width="4.5rem" height="0.875rem" />
                    </div>
                  </div>
                ))}
              </div>
              <Skeleton shape="rect" className={styles.thin} />
            </div>
            <div className={styles.buttons}>
              <span className={styles.outline} />
              <span className={styles.outline} />
            </div>
          </div>
        ))}
      </div>
    </PageSkeleton>
  );
}
