import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useId } from "react";
import { DetailsTrigger } from "@/components/ui/details-dialog";
import { Text } from "@/components/ui/text";
import { CashCard } from "@/features/finance/components/cash-card";
import { TransactionParty } from "@/features/finance/components/transaction-party";
import { TransactionReceipt } from "@/features/finance/components/transaction-receipt";
import type { FinanceSummary, Transaction, TransactionKind } from "@/features/finance/summary";
import { formatMoney } from "@/lib/utils/format";
import list from "./block-list.module.css";
import styles from "./finance-block.module.css";
import { RefreshButton } from "./refresh-button";

export type FinanceBlockProps = { summary: FinanceSummary };

const SHOWN_TRANSACTIONS = 5;

const signs: Record<TransactionKind, string> = { income: "+", expense: "-", scheduled: "" };

function dayLabel(transaction: Transaction) {
  const day = format(parseISO(transaction.date), "d MMM. yyyy", { locale: ptBR });
  return transaction.kind === "scheduled" ? `Previsto ${day}` : day;
}

// A linha é o gatilho da janela de detalhes, com o mesmo `li` e as mesmas classes de sempre; a janela é
// o recibo da movimentação.
function Row({ transaction }: { transaction: Transaction }) {
  return (
    <DetailsTrigger
      dialog={<TransactionReceipt transaction={transaction} />}
      dialogLabel={`Recibo de ${transaction.title}`}
      label={`Ver detalhes de ${transaction.title}`}
      className={list.row}
    >
      <TransactionParty transaction={transaction} />
      <span className={list.copy}>
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
    </DetailsTrigger>
  );
}

// O caixa vestido de cartão (`CashCard`, da feature de financeiro, que a página do financeiro também
// usa) com o atualizar no canto e, abaixo dele, as últimas movimentações: o que entrou, o que saiu e o que
// está por vir, cada uma com quem está do outro lado. É a visão do financeiro, e não um cartão de verdade.
export function FinanceBlock({ summary }: FinanceBlockProps) {
  const recentId = useId();

  return (
    <div className={styles.block}>
      <CashCard balance={summary.balance} action={<RefreshButton label="Atualizar saldo" />} />

      <section className={list.recent} aria-labelledby={recentId}>
        <Text as="h3" id={recentId} variant="caption1" weight="medium" tone="secondary">
          Movimentações recentes
        </Text>
        {/* O caixa continua valendo com saldo zero, então quem fica vazio aqui é só a lista: uma linha no
            lugar dela, e não o vazio inteiro, que jogaria fora o cartão do caixa acima. */}
        {summary.transactions.length === 0 ? (
          <Text variant="footnote" tone="tertiary" className={styles.none}>
            Nada entrou nem saiu ainda.
          </Text>
        ) : (
          <ul className={list.list}>
            {summary.transactions.slice(0, SHOWN_TRANSACTIONS).map((transaction) => (
              <Row key={transaction.id} transaction={transaction} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
