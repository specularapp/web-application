"use client";

import styled from "@emotion/styled";
import type { ReactNode } from "react";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DataTable, DataTableDate, DataTableEmptyValue, DataTableMoney, DataTableTitle, type DataTableColumn } from "@/components/ui/data-table";
import { Text } from "@/components/ui/text";
import { quoteStatuses } from "../labels";
import type { Quote } from "../summary";
import { quoteTotals } from "../totals";
import { QuoteHoverCard } from "./quote-hover-card";
import { QuoteMenu } from "./quote-menu";

export type QuotesTableProps = {
  quotes: Quote[];
  onOpen: (quote: Quote) => void;
  /** A paginação, no pé da tabela. */
  footer?: ReactNode;
  range: { page: number; pageSize: number; total: number };
};

// A lista de orçamentos, que é só tabela (decisão de 2026-09-09: orçar e acompanhar são a mesma tela), na
// receita das outras: compacta, com zebra, altura da tela, cabeçalho preso e a coluna de ações presa na
// ponta. Colunas: o orçamento (título e número, com a ficha resumida ao apontar), o cliente com a foto e a
// empresa embaixo, o total com as parcelas, quantos itens, a situação com o glifo dela, enviado em, válido até,
// quem responde e o leque. Ordena só por total, enviado em e válido até. A linha inteira abre o editor; pelo
// teclado quem abre é o título.
export function QuotesTable({ quotes, onOpen, footer, range }: QuotesTableProps) {
  const columns: DataTableColumn<Quote>[] = [
    {
      id: "title",
      header: "Orçamento",
      cell: (quote) => (
        <QuoteHoverCard quote={quote}>
          <DataTableTitle title={quote.title} caption={quote.number} onClick={() => onOpen(quote)} />
        </QuoteHoverCard>
      ),
    },
    {
      id: "client",
      header: "Cliente",
      hideBelow: "md",
      cell: (quote) => (
        <DataTableTitle
          title={quote.client.company ?? quote.client.name}
          caption={quote.client.company ? quote.client.name : undefined}
          media={<Avatar name={quote.client.name} src={quote.client.avatarUrl ?? undefined} size="sm" shape="squircle" />}
        />
      ),
    },
    {
      id: "total",
      header: "Total",
      align: "end",
      sortable: true,
      sortValue: (quote) => quoteTotals(quote).total,
      cell: (quote) => {
        const totals = quoteTotals(quote);
        return (
          <Line>
            <DataTableMoney cents={totals.total} size="lg" />
            {quote.installments > 1 && (
              <Text as="span" variant="caption1" tone="tertiary">
                {quote.installments}x
              </Text>
            )}
          </Line>
        );
      },
    },
    {
      id: "items",
      header: "Itens",
      align: "end",
      hideBelow: "lg",
      cell: (quote) => <QuoteItems quote={quote} />,
    },
    {
      id: "status",
      header: "Situação",
      cell: (quote) => {
        const status = quoteStatuses[quote.status];
        return (
          <Badge tone={status.tone} size="sm" icon={<status.icon />}>
            {status.label}
          </Badge>
        );
      },
    },
    {
      id: "sentAt",
      header: "Enviado em",
      sortable: true,
      sortValue: (quote) => quote.sentAt,
      hideBelow: "md",
      cell: (quote) => (quote.sentAt ? <DataTableDate iso={quote.sentAt} /> : <DataTableEmptyValue />),
    },
    {
      id: "validUntil",
      header: "Válido até",
      sortable: true,
      sortValue: (quote) => quote.validUntil,
      hideBelow: "lg",
      cell: (quote) => (quote.validUntil ? <DataTableDate iso={quote.validUntil} /> : <DataTableEmptyValue />),
    },
    {
      id: "owner",
      header: "Responsável",
      hideBelow: "lg",
      cell: (quote) => (
        <Person>
          <Avatar name={quote.owner.name} src={quote.owner.avatarUrl ?? undefined} size="xs" aria-hidden="true" />
          <Text as="span" variant="footnote" truncate>
            {quote.owner.name}
          </Text>
        </Person>
      ),
    },
  ];

  return (
    <DataTable
      label="Orçamentos"
      columns={columns}
      rows={quotes}
      rowKey={(quote) => quote.id}
      density="compact"
      zebra
      fill
      onRowClick={onOpen}
      actions={(quote) => <QuoteMenu quote={quote} onEdit={() => onOpen(quote)} />}
      range={range}
      footer={footer}
    />
  );
}

/* Valor e complemento na mesma linha, alinhados à direita como a coluna. */
const Line = styled.span`
  display: inline-flex;
  gap: var(--space-1);
  align-items: baseline;
  justify-content: flex-end;
  white-space: nowrap;
`;

/* Quem responde: a bolinha pequena e o nome numa linha só. */
const Person = styled.span`
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  min-width: 0;
  white-space: nowrap;
`;

/* Até três itens do orçamento nas bolinhas da casa, e o total ao lado: é a mesma peça da coluna de
   orçamentos do catálogo (2026-09-10, a pedido, no lugar da contagem em texto sozinha), então as duas telas
   leem igual. A semente da bolinha é o nome do item, que é o que faz o mesmo serviço desenhar sempre igual,
   como o matiz dele já faz no documento. */
const SHOWN_ITEMS = 3;

function QuoteItems({ quote }: { quote: Quote }) {
  const total = quote.lines.length;
  if (total === 0) return <DataTableEmptyValue />;
  const shown = quote.lines.slice(0, SHOWN_ITEMS);

  return (
    <Items>
      <AvatarGroup aria-label={`Itens: ${quote.lines.map((line) => line.name).join(", ")}`}>
        {shown.map((line) => (
          <Avatar key={line.id} name={line.name} size="xs" />
        ))}
      </AvatarGroup>
      <Text as="span" variant="footnote" weight="medium">
        {total}
      </Text>
    </Items>
  );
}

/* A fila de bolinhas com o total ao lado, alinhada à direita como a coluna: a receita da coluna de
   orçamentos do catálogo, com a mesma sobreposição apertada. */
const Items = styled.span`
  --avatar-overlap: var(--space-1);

  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: flex-end;
  white-space: nowrap;
`;
