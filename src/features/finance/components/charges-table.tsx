"use client";

import styled from "@emotion/styled";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DataTable, DataTableDate, DataTableEmptyValue, DataTableMoney, DataTableTitle, type DataTableColumn } from "@/components/ui/data-table";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { formatMoney } from "@/lib/utils/format";
import { chargeDirections, chargeMethods, chargeStatuses, dueLabel, dueTone, partyOf } from "../labels";
import { chargeSettled, chargeStatusOf, nextInstallment, type Charge } from "../summary";
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
  gap: var(--space-2);
  align-items: center;
  white-space: nowrap;
`;

const Paid = styled.span`
  display: grid;
  gap: var(--space-1);
  min-width: 6.5rem;
`;

const Method = styled.span`
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
  color: var(--color-label-secondary);
  white-space: nowrap;

  & svg {
    flex-shrink: 0;
    width: 0.875rem;
    height: 0.875rem;
    color: var(--color-label-tertiary);
  }
`;

/*
 * A lista de cobranças e de despesas em tabela, no desenho das tabelas da casa (reorganizada em 2026-10-27, a
 * pedido: "na mesma pegada" de contas a receber). Uma coisa por célula: a cobrança com o número, a contraparte, o
 * valor com as parcelas ao lado, o próximo vencimento numa data só, a situação já dizendo o prazo ("Vence em 7
 * dias", "Venceu há 2 dias", "Recebida"), o que já entrou ou saiu com a barra, e a forma no fim. A linha inteira
 * abre a ficha; pelo teclado quem abre é o título.
 */
export function ChargesTable({ charges, onOpen, actionsOf, footer, range, fill = true }: ChargesTableProps) {
  const outgoing = charges[0]?.direction === "outgoing";
  const side = chargeDirections[outgoing ? "outgoing" : "incoming"];

  const situationOf = (charge: Charge) => {
    const status = chargeStatusOf(charge);
    const meta = chargeStatuses[status];
    const next = nextInstallment(charge);
    if (status === "paid" || status === "cancelled" || !next) return { tone: meta.tone, icon: meta.icon, label: meta.label };
    if (next.reported) return { tone: "info" as const, icon: meta.icon, label: "Pagamento avisado" };
    return { tone: dueTone(next.dueDate), icon: meta.icon, label: dueLabel(next.dueDate) };
  };

  const columns: DataTableColumn<Charge>[] = [
    {
      id: "title",
      header: side.label,
      cell: (charge) => <DataTableTitle title={charge.title} caption={charge.reference} onClick={() => onOpen(charge)} />,
    },
    {
      id: "client",
      header: side.partyLabel,
      hideBelow: "md",
      cell: (charge) => {
        const payer = partyOf(charge);
        if (payer.standalone) return <DataTableEmptyValue />;
        return (
          <DataTableTitle
            title={payer.company ?? payer.name}
            caption={payer.company ? payer.name : undefined}
            media={<Avatar name={payer.name} src={payer.avatarUrl ?? undefined} size="xs" />}
          />
        );
      },
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
          {charge.installments.length > 1 && (
            <Text as="span" variant="caption1" tone="tertiary" numeric>
              {charge.installments.length}x
            </Text>
          )}
        </Line>
      ),
    },
    {
      id: "due",
      header: "Vencimento",
      sortable: true,
      sortValue: (charge) => nextInstallment(charge)?.dueDate ?? "9999",
      cell: (charge) => {
        const next = nextInstallment(charge);
        return next && !charge.cancelledAt ? <DataTableDate iso={next.dueDate} /> : <DataTableEmptyValue />;
      },
    },
    {
      id: "status",
      header: "Situação",
      cell: (charge) => {
        const situation = situationOf(charge);
        return (
          <Badge tone={situation.tone} size="sm" icon={<situation.icon />}>
            {situation.label}
          </Badge>
        );
      },
    },
    {
      id: "received",
      header: outgoing ? "Pago" : "Recebido",
      hideBelow: "lg",
      sortable: true,
      sortValue: (charge) => chargeSettled(charge) / Math.max(1, charge.amount),
      cell: (charge) => {
        const received = chargeSettled(charge);
        return (
          <Paid>
            <Text as="span" variant="footnote" weight="medium" numeric>
              {formatMoney(received)}
            </Text>
            <Progress variant="bar" value={received} max={charge.amount} size="xs" tone={chargeStatusOf(charge) === "overdue" ? "danger" : outgoing ? "accent" : "success"} aria-label={`${outgoing ? "Pago" : "Recebido"} ${formatMoney(received)} de ${formatMoney(charge.amount)}`} />
          </Paid>
        );
      },
    },
    {
      id: "method",
      header: "Forma",
      hideBelow: "lg",
      cell: (charge) => {
        const method = chargeMethods[charge.method];
        return (
          <Method>
            <method.icon aria-hidden="true" />
            <Text as="span" variant="footnote" tone="inherit">
              {method.label}
            </Text>
          </Method>
        );
      },
    },
  ];

  return (
    <DataTable<Charge>
      label={outgoing ? "Despesas" : "Cobranças"}
      columns={columns}
      rows={charges}
      rowKey={(charge) => charge.id}
      onRowClick={onOpen}
      actions={(charge) => <ChargeMenu charge={charge} onOpen={() => onOpen(charge)} {...actionsOf(charge)} />}
      fill={fill}
      footer={footer}
      range={range}
      empty={
        <Text variant="footnote" tone="secondary">
          Nenhum lançamento por aqui.
        </Text>
      }
    />
  );
}
