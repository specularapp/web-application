import { CheckCircleIcon } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { Logo } from "@/components/layout/logo";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { squircle } from "@/lib/corners";
import { cx } from "@/lib/utils/cx";
import { formatMoney } from "@/lib/utils/format";
import styles from "./cash-card.module.css";

export type CashCardProps = {
  /** Saldo em caixa, em centavos. */
  balance: number;
  /** O que fica no canto de baixo à direita, como o atualizar do painel. */
  action?: ReactNode;
  /** A linha de apoio abaixo do saldo, quando há o que dizer ("R$ 12.000 a receber"). */
  caption?: string;
  className?: string;
};

// O caixa vestido de cartão (do bloco do painel, 2026-09-05; saiu para aqui em 2026-09-15 quando a página do
// financeiro passou a usá-lo também): grade 2x2 com a marca e a situação em cima, o saldo e a ação embaixo,
// na proporção de um cartão de verdade. É a visão do financeiro, e não um cartão real.
export function CashCard({ balance, action, caption, className }: CashCardProps) {
  return (
    <div className={cx(styles.card, className)} {...squircle("lg")}>
      <Logo variant="icon" height={24} className={styles.brand} />
      <Badge tone="success" size="sm" icon={<CheckCircleIcon />} className={styles.status}>
        Ativo
      </Badge>
      <div className={styles.balance}>
        <Text as="p" variant="footnote" tone="secondary">
          Em caixa
        </Text>
        <Text as="p" variant="title1" weight="semibold" truncate>
          {formatMoney(balance)}
        </Text>
        {caption && (
          <Text as="p" variant="caption1" tone="secondary" truncate>
            {caption}
          </Text>
        )}
      </div>
      {action && <span className={styles.action}>{action}</span>}
    </div>
  );
}
