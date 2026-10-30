"use client";

import { ArrowRightIcon, ArrowUUpLeftIcon, ArrowsLeftRightIcon, CheckCircleIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { formatMoney } from "@/lib/utils/format";
import type { FinanceAccount, FinanceTransfer } from "../accounts";
import { shortDate } from "../labels";
import { AccountMark } from "./account-mark";
import { FinanceCard, financeCard as styles } from "./finance-card";
import own from "./transfer-card.module.css";

export type TransferCardProps = {
  transfer: FinanceTransfer;
  from: FinanceAccount | null;
  to: FinanceAccount | null;
  menu: ReactNode;
  onOpen: () => void;
};

/**
 * Uma transferência em cartão (2026-10-29), no molde do cartão de despesa: o tipo e a situação com o leque em cima;
 * o motivo com o código; as duas contas, de onde saiu e para onde foi, cada uma com a marca do banco; o valor; e
 * no pé o dia. A desfeita fica apagada. O cartão inteiro abre o comprovante.
 */
export function TransferCard({ transfer, from, to, menu, onOpen }: TransferCardProps) {
  const title = transfer.note || "Entre contas";
  const label = [`Ver o comprovante de ${transfer.reference}`, title, `${formatMoney(transfer.amount)} de ${from?.name ?? "uma conta"} para ${to?.name ?? "outra"}`, transfer.undone ? "Desfeita" : "Feita", shortDate(transfer.date)].join(". ");

  return (
    <FinanceCard label={label} cancelled={transfer.undone} onOpen={onOpen}>
      <header className={styles.head}>
        <Badge tone="blue" variant="soft" size="sm" icon={<ArrowsLeftRightIcon />}>
          Transferência
        </Badge>
        <Badge tone={transfer.undone ? "neutral" : "success"} size="sm" icon={transfer.undone ? <ArrowUUpLeftIcon /> : <CheckCircleIcon />}>
          {transfer.undone ? "Desfeita" : "Feita"}
        </Badge>
        {menu}
      </header>

      <div className={styles.copy}>
        <Text as="h2" variant="headline" weight="semibold" className={styles.title}>
          {title}
        </Text>
        <Text as="p" variant="caption1" tone="secondary">
          {transfer.reference}
        </Text>
      </div>

      {/* As duas pontas lado a lado, com a seta no meio: de onde saiu e para onde foi */}
      <div className={`${styles.client} ${own.route}`}>
        {[
          { account: from, caption: "Saiu de" },
          { account: to, caption: "Entrou em" },
        ].map((end, index) => (
          <span key={end.caption} className={own.end}>
            {index === 1 && <ArrowRightIcon aria-hidden="true" className={own.arrow} />}
            {end.account && <AccountMark account={end.account} size="md" />}
            <span className={styles.clientCopy}>
              <Text as="span" variant="caption1" tone="secondary">
                {end.caption}
              </Text>
              <Text as="span" variant="footnote" weight="medium" truncate>
                {end.account?.name ?? "Conta removida"}
              </Text>
            </span>
          </span>
        ))}
      </div>

      <div className={styles.amount}>
        <Text as="span" variant="title3" weight="semibold">
          {formatMoney(transfer.amount)}
        </Text>
      </div>

      <footer className={styles.foot}>
        <Text as="span" variant="caption1" tone="secondary" truncate>
          {shortDate(transfer.date)}
        </Text>
      </footer>
    </FinanceCard>
  );
}
