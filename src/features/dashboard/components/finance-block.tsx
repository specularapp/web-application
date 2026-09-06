import type { Icon } from "@phosphor-icons/react";
import { ArrowDownLeftIcon, ArrowUpRightIcon, CalendarCheckIcon, CheckCircleIcon } from "@phosphor-icons/react/ssr";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useId } from "react";
import { Logo } from "@/components/layout/logo";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BrandIcon } from "@/components/ui/brand-icon";
import { Text } from "@/components/ui/text";
import type { FinanceSummary, Transaction, TransactionKind } from "@/features/finance/summary";
import { iconButtonCornerRadius, squircle, squirclePx } from "@/lib/corners";
import { formatMoney } from "@/lib/utils/format";
import styles from "./finance-block.module.css";
import { RefreshButton } from "./refresh-button";

export type FinanceBlockProps = { summary: FinanceSummary };

const SHOWN_TRANSACTIONS = 5;

const icons: Record<TransactionKind, Icon> = {
  income: ArrowDownLeftIcon,
  expense: ArrowUpRightIcon,
  scheduled: CalendarCheckIcon,
};

const signs: Record<TransactionKind, string> = { income: "+", expense: "-", scheduled: "" };

/* Chip de 36px no raio de metade do lado, a escala do botão de ícone, recortado no fallback porque não
   tem borda. */
const chipCorner = squirclePx(iconButtonCornerRadius.sm, { clip: true });

function dayLabel(transaction: Transaction) {
  const day = format(parseISO(transaction.date), "d MMM. yyyy", { locale: ptBR });
  return transaction.kind === "scheduled" ? `Previsto ${day}` : day;
}

// Quem aparece na linha: a pessoa pelo `Avatar` (foto, ou o rosto gerado), o serviço pela logo em
// cores num chip, e, sem nenhum dos dois, o ícone do tipo. Os três têm o mesmo tamanho e canto.
function Party({ transaction }: { transaction: Transaction }) {
  const { visual } = transaction;

  if (visual?.type === "person") {
    return <Avatar name={transaction.title} src={visual.avatarUrl ?? undefined} size="sm" shape="squircle" />;
  }

  if (visual?.type === "brand") {
    return (
      <span className={styles.party} data-brand aria-hidden="true" {...chipCorner}>
        <BrandIcon name={visual.name} color />
      </span>
    );
  }

  const Glyph = icons[transaction.kind];
  return (
    <span className={styles.party} data-glyph aria-hidden="true" {...chipCorner}>
      <Glyph weight="bold" />
    </span>
  );
}

function Row({ transaction }: { transaction: Transaction }) {
  return (
    <li className={styles.row} data-kind={transaction.kind}>
      <Party transaction={transaction} />
      <span className={styles.copy}>
        <Text as="span" variant="subheadline" weight="medium" truncate>
          {transaction.title}
        </Text>
        <Text as="span" variant="footnote" tone="secondary" truncate>
          {transaction.description}
        </Text>
      </span>
      <span className={styles.amount}>
        <Text as="span" variant="subheadline" weight="semibold" numeric>
          {signs[transaction.kind]}
          {formatMoney(transaction.amount)}
        </Text>
        <Text as="span" variant="caption1" tone="secondary" numeric>
          {dayLabel(transaction)}
        </Text>
      </span>
    </li>
  );
}

// O caixa vestido de cartão, em grade 2x2: a marca e a situação em cima, o saldo e o atualizar
// embaixo. Abaixo dele, as últimas movimentações: o que entrou, o que saiu e o que está por vir,
// cada uma com quem está do outro lado. É a visão do financeiro, e não um cartão de verdade.
export function FinanceBlock({ summary }: FinanceBlockProps) {
  const recentId = useId();

  return (
    <div className={styles.block}>
      <div className={styles.card} {...squircle("lg")}>
        <Logo variant="icon" height={24} className={styles.brand} />
        <Badge tone="success" size="sm" icon={<CheckCircleIcon />} className={styles.status}>
          Ativo
        </Badge>
        <div className={styles.balance}>
          <Text as="p" variant="footnote" tone="secondary">
            Em caixa
          </Text>
          <Text as="p" variant="title1" weight="semibold" truncate>
            {formatMoney(summary.balance)}
          </Text>
        </div>
        <span className={styles.refresh}>
          <RefreshButton label="Atualizar saldo" />
        </span>
      </div>

      <section className={styles.recent} aria-labelledby={recentId}>
        <Text as="h3" id={recentId} variant="caption1" weight="medium" tone="secondary">
          Movimentações recentes
        </Text>
        <ul className={styles.list}>
          {summary.transactions.slice(0, SHOWN_TRANSACTIONS).map((transaction) => (
            <Row key={transaction.id} transaction={transaction} />
          ))}
        </ul>
      </section>
    </div>
  );
}
