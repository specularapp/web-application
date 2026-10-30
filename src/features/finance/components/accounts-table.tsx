"use client";

import styled from "@emotion/styled";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { DataTable, DataTableEmptyValue, DataTableMoney, DataTableTitle, type DataTableColumn } from "@/components/ui/data-table";
import { Text } from "@/components/ui/text";
import { formatMoney } from "@/lib/utils/format";
import { accountDigits, accountIdentity, accountKinds, type AccountMovement, type FinanceAccount } from "../accounts";
import { AccountMark } from "./account-mark";
import { dayMonth } from "./money";

export type AccountsTableProps = {
  accounts: FinanceAccount[];
  /** O último movimento de cada conta, que a prancha já calcula para os cartões. */
  lastOf: (account: FinanceAccount) => AccountMovement | null;
  onOpen: (account: FinanceAccount) => void;
  actionsOf: (account: FinanceAccount) => ReactNode;
};

const Tags = styled.span`
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
  white-space: nowrap;
`;

/* O valor de 30 dias, verde no que entrou e vermelho no que saiu; o saldo negativo também fica vermelho. */
const Flow = styled.span`
  font-size: var(--text-footnote);
  font-weight: var(--weight-medium);
  white-space: nowrap;

  &[data-size="lg"] {
    font-size: var(--text-subheadline);
    font-weight: var(--weight-semibold);
  }

  &[data-kind="in"] {
    color: var(--color-success);
  }

  &[data-kind="out"] {
    color: var(--color-danger);
  }
`;

/*
 * As contas bancárias em tabela (2026-10-29, a pedido: "faça ter visualização em tabela também"): a conta com a
 * marca do banco, o tipo com as etiquetas de padrão e inativa, a agência e o número, o saldo, o que entrou e saiu
 * em 30 dias e o último movimento. A linha inteira abre o extrato, como o botão Extrato do cartão.
 */
export function AccountsTable({ accounts, lastOf, onOpen, actionsOf }: AccountsTableProps) {
  const columns: DataTableColumn<FinanceAccount>[] = [
    {
      id: "account",
      header: "Conta",
      cell: (account) => {
        const { title, subtitle } = accountIdentity(account);
        return <DataTableTitle title={title} caption={subtitle} media={<AccountMark account={account} />} onClick={() => onOpen(account)} />;
      },
    },
    {
      id: "kind",
      header: "Tipo",
      cell: (account) => (
        <Tags>
          <Badge tone={accountKinds[account.kind].tone} size="sm">
            {accountKinds[account.kind].label}
          </Badge>
          {account.isDefault && (
            <Badge tone="neutral" size="sm">
              Padrão
            </Badge>
          )}
          {!account.active && (
            <Badge tone="warning" size="sm">
              Inativa
            </Badge>
          )}
        </Tags>
      ),
    },
    {
      id: "digits",
      header: "Agência e número",
      cell: (account) => {
        const digits = accountDigits(account);
        return digits ? (
          <Text as="span" variant="footnote" tone="secondary" truncate>
            {digits}
          </Text>
        ) : (
          <DataTableEmptyValue />
        );
      },
    },
    {
      id: "balance",
      header: "Saldo",
      align: "end",
      sortable: true,
      sortValue: (account) => account.balance,
      cell: (account) =>
        account.balance < 0 ? (
          <Flow data-size="lg" data-kind="out">
            {formatMoney(account.balance)}
          </Flow>
        ) : (
          <DataTableMoney cents={account.balance} size="lg" />
        ),
    },
    {
      id: "in",
      header: "Entrou em 30 dias",
      align: "end",
      sortable: true,
      sortValue: (account) => account.recentIn,
      cell: (account) => (
        <Flow data-kind={account.recentIn > 0 ? "in" : undefined}>
          {formatMoney(account.recentIn)}
        </Flow>
      ),
    },
    {
      id: "out",
      header: "Saiu em 30 dias",
      align: "end",
      sortable: true,
      sortValue: (account) => account.recentOut,
      cell: (account) => (
        <Flow data-kind={account.recentOut > 0 ? "out" : undefined}>
          {formatMoney(account.recentOut)}
        </Flow>
      ),
    },
    {
      id: "last",
      header: "Último movimento",
      sortable: true,
      sortValue: (account) => lastOf(account)?.date ?? "",
      cell: (account) => {
        const last = lastOf(account);
        return last ? <DataTableTitle title={last.title} caption={dayMonth(last.date)} /> : <DataTableEmptyValue />;
      },
    },
  ];

  return (
    <DataTable<FinanceAccount>
      label="Contas bancárias"
      columns={columns}
      rows={accounts}
      rowKey={(account) => account.id}
      onRowClick={onOpen}
      actions={actionsOf}
      fill
      empty={
        <Text variant="footnote" tone="secondary">
          Nenhuma conta por aqui.
        </Text>
      }
    />
  );
}
