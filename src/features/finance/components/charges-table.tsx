"use client";

import styled from "@emotion/styled";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DataTable, DataTableDate, DataTableMoney, DataTableTitle, type DataTableColumn } from "@/components/ui/data-table";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { formatMoney } from "@/lib/utils/format";
import { chargeMethods, chargeStatuses, dueLabel, dueTone } from "../labels";
import { chargeReceived, chargeStatusOf, nextInstallment, type Charge } from "../summary";
import { ChargeMenu, type ChargeMenuActions } from "./charge-menu";

export type ChargesTableProps = {
  charges: Charge[];
  onOpen: (charge: Charge) => void;
  /** As ações do leque de cada linha, montadas por quem lista. */
  actionsOf: (charge: Charge) => ChargeMenuActions;
  footer?: ReactNode;
  range: { page: number; pageSize: number; total: number };
  fill?: boolean;
};

const Line = styled.span`
  display: inline-flex;
  gap: var(--space-1);
  align-items: baseline;
  white-space: nowrap;
`;

const Stack = styled.span`
  display: grid;
  gap: var(--space-1);
  min-width: 7rem;
`;

// A lista de cobranças em tabela, na receita das outras: compacta, com zebra, cabeçalho preso e a coluna de
// ações presa na ponta. Colunas: a cobrança (título e número), o cliente com a foto, o valor com as parcelas e
// a forma, o que já entrou em barra, a próxima parcela com o vencimento em palavras, a situação com o glifo e
// o leque. A linha inteira abre a ficha; pelo teclado quem abre é o título.
export function ChargesTable({ charges, onOpen, actionsOf, footer, range, fill = true }: ChargesTableProps) {
  const columns: DataTableColumn<Charge>[] = [
    {
      id: "title",
      header: "Cobrança",
      cell: (charge) => <DataTableTitle title={charge.title} caption={charge.reference} onClick={() => onOpen(charge)} />,
    },
    {
      id: "client",
      header: "Cliente",
      hideBelow: "md",
      cell: (charge) => (
        <DataTableTitle
          title={charge.client.company ?? charge.client.name}
          caption={charge.client.company ? charge.client.name : undefined}
          media={<Avatar name={charge.client.name} src={charge.client.avatarUrl ?? undefined} size="sm" shape="squircle" />}
        />
      ),
    },
    {
      id: "amount",
      header: "Valor",
      align: "end",
      sortable: true,
      sortValue: (charge) => charge.amount,
      cell: (charge) => (
        <Line>
          <DataTableMoney cents={charge.amount} size="lg" />
          <Text as="span" variant="caption1" tone="tertiary">
            {charge.installments.length > 1 ? `${charge.installments.length}x` : chargeMethods[charge.method].label}
          </Text>
        </Line>
      ),
    },
    {
      id: "received",
      header: "Recebido",
      hideBelow: "lg",
      sortable: true,
      sortValue: (charge) => chargeReceived(charge) / Math.max(1, charge.amount),
      cell: (charge) => {
        const received = chargeReceived(charge);
        return (
          <Stack>
            <Progress value={received} max={charge.amount} size="xs" tone={chargeStatusOf(charge) === "overdue" ? "danger" : "success"} aria-label={`Recebido ${formatMoney(received)} de ${formatMoney(charge.amount)}`} />
            <Text as="span" variant="caption1" tone="secondary" numeric>
              {formatMoney(received)} de {formatMoney(charge.amount)}
            </Text>
          </Stack>
        );
      },
    },
    {
      id: "due",
      header: "Próxima parcela",
      hideBelow: "md",
      sortable: true,
      sortValue: (charge) => nextInstallment(charge)?.dueDate ?? "9999",
      cell: (charge) => {
        const next = nextInstallment(charge);
        if (charge.cancelledAt || !next) {
          return (
            <Text as="span" variant="caption1" tone="tertiary">
              {charge.cancelledAt ? "Cancelada" : "Tudo recebido"}
            </Text>
          );
        }
        return (
          <Stack>
            <DataTableDate iso={next.dueDate} />
            <Badge tone={next.reported ? "info" : dueTone(next.dueDate)} size="sm">
              {next.reported ? "Pagamento avisado" : dueLabel(next.dueDate)}
            </Badge>
          </Stack>
        );
      },
    },
    {
      id: "status",
      header: "Situação",
      cell: (charge) => {
        const status = chargeStatuses[chargeStatusOf(charge)];
        return (
          <Badge tone={status.tone} size="sm" icon={<status.icon />}>
            {status.label}
          </Badge>
        );
      },
    },
  ];

  return (
    <DataTable<Charge>
      label="Cobranças"
      columns={columns}
      rows={charges}
      rowKey={(charge) => charge.id}
      onRowClick={onOpen}
      actions={(charge) => <ChargeMenu charge={charge} onOpen={() => onOpen(charge)} {...actionsOf(charge)} />}
      density="compact"
      zebra
      fill={fill}
      footer={footer}
      range={range}
      empty={
        <Text variant="footnote" tone="secondary">
          Nenhuma cobrança por aqui.
        </Text>
      }
    />
  );
}
