"use client";

import { ArrowDownLeftIcon, ArrowUpRightIcon, type Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { formatMoney } from "@/lib/utils/format";
import { accountIdentity, type FinanceAccount } from "../accounts";
import type { FinanceCategory } from "../installments";
import { chargeMethods, shortDate } from "../labels";
import type { MovementEntry } from "../movements";
import { AccountMark } from "./account-mark";
import { FinanceCard, financeCard as styles } from "./finance-card";
import { signedMoney } from "./money";

export type MovementCardProps = {
  entry: MovementEntry;
  /** Parcela recebida ou paga, avulsa ou estornada: a mesma etiqueta da coluna Tipo. */
  type: { tone: BadgeTone; icon: Icon; label: string };
  category: FinanceCategory | null;
  account: FinanceAccount | null;
  menu: ReactNode;
  onOpen: () => void;
};

/**
 * Uma movimentação em cartão (2026-10-29), no molde do cartão de despesa: entrada ou saída e o tipo com o leque em
 * cima; o nome com o código; a conta onde o dinheiro entrou ou saiu, com a marca do banco; o valor com sinal e a
 * forma; e no pé o dia e a categoria. O estornado fica apagado. O cartão inteiro abre o recibo.
 */
export function MovementCard({ entry, type, category, account, menu, onOpen }: MovementCardProps) {
  const income = entry.kind === "income";
  const method = entry.method ? chargeMethods[entry.method] : null;
  const label = [`Ver o recibo de ${entry.title} ${entry.reference}`, `${income ? "Entrada" : "Saída"} de ${formatMoney(entry.amount)}`, type.label, account?.name ?? "", shortDate(entry.date)].filter(Boolean).join(". ");

  return (
    <FinanceCard label={label} cancelled={entry.status === "cancelled"} onOpen={onOpen}>
      <header className={styles.head}>
        <Badge tone={income ? "success" : "danger"} variant="soft" size="sm" icon={income ? <ArrowDownLeftIcon /> : <ArrowUpRightIcon />}>
          {income ? "Entrada" : "Saída"}
        </Badge>
        <Badge tone={type.tone} size="sm" icon={<type.icon />}>
          {type.label}
        </Badge>
        {menu}
      </header>

      <div className={styles.copy}>
        <Text as="h2" variant="headline" weight="semibold" className={styles.title}>
          {entry.title}
        </Text>
        <Text as="p" variant="caption1" tone="secondary">
          {entry.reference}
        </Text>
      </div>

      {account && (
        <div className={styles.client}>
          <AccountMark account={account} size="md" />
          <span className={styles.clientCopy}>
            <Text as="span" variant="footnote" weight="medium" truncate>
              {account.name}
            </Text>
            <Text as="span" variant="caption1" tone="secondary" truncate>
              {accountIdentity(account).subtitle}
            </Text>
          </span>
        </div>
      )}

      <div className={styles.amount}>
        <Text as="span" variant="title3" weight="semibold" tone={entry.status === "cancelled" ? "tertiary" : income ? undefined : "danger"}>
          {signedMoney(income ? entry.amount : -entry.amount)}
        </Text>
        <Text as="span" variant="caption1" tone="secondary" className={styles.terms}>
          {method && <method.icon aria-hidden="true" />}
          {method?.label ?? "Forma não informada"}
        </Text>
      </div>

      <footer className={styles.foot}>
        <Text as="span" variant="caption1" tone="secondary" truncate>
          {shortDate(entry.date)}
        </Text>
        {category && (
          <Badge tone={category.hue} size="sm">
            {category.name}
          </Badge>
        )}
      </footer>
    </FinanceCard>
  );
}
