"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import styles from "./charge-card.module.css";

const INTERACTIVE = "button, a, input, label, [role='button'], [role='menuitem']";

/**
 * A casca dos cartões das listas do financeiro (2026-10-29, a pedido: "use como referência o despesas para
 * modelar"): a mesma caixa, o mesmo fio e o mesmo clique do cartão de cobrança e despesa (`charge-card.module.css`),
 * para parcela, movimentação e transferência lerem como a mesma família. O cartão inteiro abre; o leque de dentro
 * tem clique próprio. `label` é o nome composto que o leitor de tela ouve, porque `role="button"` esconde o resto.
 */
export function FinanceCard({ label, cancelled, onOpen, children }: { label: string; cancelled?: boolean; onOpen: () => void; children: ReactNode }) {
  const onClick = (event: MouseEvent<HTMLElement>) => {
    const control = (event.target as HTMLElement).closest(INTERACTIVE);
    if (control && control !== event.currentTarget) return;
    onOpen();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <article className={styles.card} data-status={cancelled ? "cancelled" : undefined}>
      <div className={styles.inner} role="button" tabIndex={0} aria-label={label} onClick={onClick} onKeyDown={onKeyDown}>
        {children}
      </div>
    </article>
  );
}

export { styles as financeCard };
