"use client";

import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { formatMoney } from "@/lib/utils/format";
import type { FinanceAccount } from "../accounts";
import { installmentLabelOf, installmentSides, installmentStatuses, isPending, type FinanceCategory, type InstallmentEntry } from "../installments";
import { chargeDirections, chargeMethods, shortDate } from "../labels";
import { AccountMark } from "./account-mark";
import { FinanceCard, financeCard as styles } from "./finance-card";

export type InstallmentCardProps = {
  entry: InstallmentEntry;
  /** O prazo em palavras ("Vence em 3 dias", "Recebida em 05/11"), o mesmo da coluna Situação. */
  due: { tone: BadgeTone; icon: Icon; label: string };
  category: FinanceCategory | null;
  account: FinanceAccount | null;
  menu: ReactNode;
  onOpen: () => void;
};

/**
 * Uma parcela de contas a receber ou a pagar em cartão (2026-10-29), no molde do cartão de despesa: o lado e a
 * situação com o leque em cima; a cobrança com o número; quem paga ou recebe, com o rosto; o valor com a parcela
 * e a forma; e no pé o vencimento com o prazo em palavras, ou a conta onde a baixa caiu. Abre o mesmo que a
 * linha da tabela: a baixa, se pendente; a cobrança, se não.
 */
export function InstallmentCard({ entry, due, category, account, menu, onOpen }: InstallmentCardProps) {
  const side = chargeDirections[entry.direction];
  const words = installmentSides[entry.direction];
  const status = installmentStatuses[entry.status];
  const method = chargeMethods[entry.method];
  const party = entry.party.company ?? entry.party.name;
  const pending = isPending(entry.status);
  const label = [`${pending ? words.settleTitle : "Abrir"} ${entry.title} ${entry.reference}`, party, `${formatMoney(entry.amount)}, ${installmentLabelOf(entry)}, ${method.label}`, due.label].join(". ");

  return (
    <FinanceCard label={label} cancelled={entry.status === "cancelled"} onOpen={onOpen}>
      <header className={styles.head}>
        <Badge tone={side.tone} variant="soft" size="sm" icon={<side.icon />}>
          {side.listLabel}
        </Badge>
        <Badge tone={status.tone} size="sm" icon={<status.icon />}>
          {status.label[entry.direction]}
        </Badge>
        {menu}
      </header>

      <div className={styles.copy}>
        <Text as="h2" variant="headline" weight="semibold" className={styles.title}>
          {entry.title}
        </Text>
        <Text as="p" variant="caption1" tone="secondary">
          {entry.reference}
          {category ? `, ${category.name}` : ""}
        </Text>
      </div>

      <div className={styles.client}>
        <Avatar name={entry.party.name} src={entry.party.avatarUrl ?? undefined} size="sm" shape="rounded" />
        <span className={styles.clientCopy}>
          <Text as="span" variant="footnote" weight="medium" truncate>
            {party}
          </Text>
          <Text as="span" variant="caption1" tone="secondary" truncate>
            {entry.party.standalone ? `${side.label} avulsa` : entry.party.company ? entry.party.name : words.party}
          </Text>
        </span>
      </div>

      <div className={styles.amount}>
        <Text as="span" variant="title3" weight="semibold">
          {formatMoney(entry.amount)}
        </Text>
        <Text as="span" variant="caption1" tone="secondary" className={styles.terms}>
          <method.icon aria-hidden="true" />
          {installmentLabelOf(entry)}, {method.label}
        </Text>
      </div>

      <footer className={styles.foot}>
        {pending ? (
          <>
            <Text as="span" variant="caption1" tone="secondary" truncate>
              Vencimento, {shortDate(entry.dueDate)}
            </Text>
            <Badge tone={due.tone} size="sm">
              {due.label}
            </Badge>
          </>
        ) : (
          <>
            <Text as="span" variant="caption1" tone="secondary" truncate>
              {entry.status === "paid" ? `${words.settled} em ${shortDate(entry.paidOn ?? entry.dueDate)}` : `Venceria em ${shortDate(entry.dueDate)}`}
            </Text>
            {account && entry.status === "paid" && (
              <Text as="span" variant="caption1" tone="secondary" className={styles.terms}>
                <AccountMark account={account} />
                {account.name}
              </Text>
            )}
          </>
        )}
      </footer>
    </FinanceCard>
  );
}
