"use client";

import { memo, type CSSProperties } from "react";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { rounded } from "@/lib/corners";
import { compactMoney } from "@/lib/utils/format";
import { contractStatuses } from "../labels";
import type { Contract, ContractStatus } from "../summary";
import { ContractCard } from "./contract-card";
import type { ContractMenuActions } from "./contract-menu";
import styles from "./contracts-funnel.module.css";

/** As etapas do funil de contratos, na ordem do caminho: do rascunho à assinatura, e o cancelado no fim. */
export const contractFunnelStages: ContractStatus[] = ["draft", "sent", "partial", "signed", "cancelled"];

/* A cor de cada etapa, a mesma da etiqueta da situação, como matiz do sistema para a coluna se tingir. */
const stageHues: Record<ContractStatus, string> = {
  draft: "var(--sys-gray)",
  sent: "var(--color-accent)",
  partial: "var(--sys-orange)",
  signed: "var(--sys-green)",
  cancelled: "var(--sys-red)",
};

/* O que cada cartão pede para agir sobre o contrato dele: as ações do leque, já presas ao contrato. */
export type ContractActionsFor = (contract: Contract) => ContractMenuActions & { onOpen: () => void };

export type ContractsFunnelProps = {
  contracts: Contract[];
  actionsFor: ContractActionsFor;
};

/**
 * Os contratos em etapas (2026-10-26, a pedido: "a visualização em etapas para ficar mais organizado"): uma
 * coluna por situação, na ordem em que o contrato anda, no desenho do funil de orçamentos: o véu da cor da etapa, a etiqueta com o glifo, o nome e a
 * contagem, o valor somado da etapa ao lado e os cartões embaixo. A situação muda pelo que acontece com o
 * contrato (enviar, cada parte assinar, cancelar), e não arrastando, então as colunas só mostram.
 */
function ContractsFunnelBase({ contracts, actionsFor }: ContractsFunnelProps) {
  return (
    <div className={styles.rail}>
      {contractFunnelStages.map((stage) => {
        const status = contractStatuses[stage];
        const Glyph = status.icon;
        const items = contracts.filter((contract) => contract.status === stage);
        const total = items.reduce((sum, contract) => sum + (contract.amount ?? 0), 0);
        return (
          <section key={stage} className={styles.column} style={{ "--stage-hue": stageHues[stage] } as CSSProperties} aria-label={`${status.label}, ${items.length} contratos`}>
            <header className={styles.head}>
              <h2 className={styles.stage} {...rounded("md", { clip: true })}>
                <Glyph aria-hidden="true" className={styles.glyph} weight="bold" />
                <span className={styles.name}>{status.label}</span>
                <span className={styles.count} aria-hidden="true" {...rounded("sm", { clip: true })}>
                  {items.length}
                </span>
                <VisuallyHidden>{items.length === 1 ? "1 contrato" : `${items.length} contratos`}</VisuallyHidden>
              </h2>
              {total > 0 && <span className={styles.total}>{compactMoney(total)}</span>}
            </header>
            <div className={styles.body}>
              {items.length === 0 ? (
                <p className={styles.empty}>Nenhum contrato</p>
              ) : (
                <ul className={styles.list}>
                  {items.map((contract) => (
                    <ContractCard key={contract.id} contract={contract} {...actionsFor(contract)} />
                  ))}
                </ul>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* Memorizado: cada tecla na busca refazia as colunas antes de a espera deixar a busca ir ao servidor. */
export const ContractsFunnel = memo(ContractsFunnelBase);
