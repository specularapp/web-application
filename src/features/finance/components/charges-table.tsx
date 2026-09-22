"use client";

import styled from "@emotion/styled";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DataTable, DataTableDate, DataTableMoney, DataTableTitle, type DataTableColumn } from "@/components/ui/data-table";
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
      header: "Lançamento",
      cell: (charge) => <DataTableTitle title={charge.title} caption={charge.reference} onClick={() => onOpen(charge)} />,
    },
    {
      /* O lado logo depois do nome: numa lista que mistura as duas pontas, saber se aquela linha entra ou
         sai é o que se lê antes do valor. "Em aberto" quer dizer coisas opostas de um lado e do outro. */
      id: "side",
      header: "Lado",
      hideBelow: "md",
      cell: (charge) => {
        const side = chargeDirections[charge.direction];
        return (
          <Badge tone={side.tone} variant="soft" size="sm" icon={<side.icon />}>
            {side.listLabel}
          </Badge>
        );
      },
    },
    {
      id: "client",
      header: "Contraparte",
      hideBelow: "md",
      cell: (charge) => {
        const payer = partyOf(charge);
        return (
          <DataTableTitle
            title={payer.company ?? payer.name}
            caption={payer.company ? payer.name : payer.standalone ? `${chargeDirections[charge.direction].label} avulsa` : undefined}
            media={<Avatar name={payer.name} src={payer.avatarUrl ?? undefined} size="sm" shape="squircle" />}
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
          <Text as="span" variant="caption1" tone="tertiary">
            {charge.installments.length > 1 ? `${charge.installments.length}x` : chargeMethods[charge.method].label}
          </Text>
        </Line>
      ),
    },
    {
      id: "received",
      header: "Liquidado",
      hideBelow: "lg",
      sortable: true,
      sortValue: (charge) => chargeSettled(charge) / Math.max(1, charge.amount),
      cell: (charge) => {
        const received = chargeSettled(charge);
        return (
          <Stack>
            <Progress value={received} max={charge.amount} size="xs" tone={chargeStatusOf(charge) === "overdue" ? "danger" : charge.direction === "outgoing" ? "accent" : "success"} aria-label={`${charge.direction === "outgoing" ? "Pago" : "Recebido"} ${formatMoney(received)} de ${formatMoney(charge.amount)}`} />
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
              {charge.cancelledAt ? "Cancelada" : charge.direction === "outgoing" ? "Tudo pago" : "Tudo recebido"}
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
      label={charges[0]?.direction === "outgoing" ? "Despesas" : "Cobranças"}
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
          Nenhum lançamento por aqui.
        </Text>
      }
    />
  );
}
