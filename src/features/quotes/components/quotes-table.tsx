"use client";

import styled from "@emotion/styled";
import type { CSSProperties, ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DataTable, DataTableDate, DataTableEmptyValue, DataTableMoney, DataTableTitle, type DataTableColumn } from "@/components/ui/data-table";
import { Text } from "@/components/ui/text";
import { catalogArtworkUrl } from "@/features/catalog/list-options";
import { quoteStatuses } from "../labels";
import type { Quote } from "../summary";
import { quoteTotals } from "../totals";
import { lineArtwork } from "./quote-document";
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

/* Até três itens do orçamento em bolinha, e o total ao lado: a peça da coluna de orçamentos do catálogo
   (2026-09-10, a pedido), com uma diferença que é o ponto — **o desenho é o do item, e não um rosto**. Lá as
   bolinhas são de gente, e o `Avatar` desenha rosto; aqui elas são dos serviços orçados, então dentro vai a
   arte do catálogo, a mesma que o documento e a grade mostram, sobre o véu do matiz do item.

   A arte vem da rota, como em todo lugar da casa: é um arquivo com cache de um ano, então o mesmo item em
   cinco telas custa uma requisição. O matiz e o desenho nascem do nome e do id da linha, como no documento,
   o que faz o mesmo serviço sair igual em qualquer tela. */
const SHOWN_ITEMS = 3;

function QuoteItems({ quote }: { quote: Quote }) {
  const total = quote.lines.length;
  if (total === 0) return <DataTableEmptyValue />;
  const shown = quote.lines.slice(0, SHOWN_ITEMS);

  return (
    <Items>
      <Dots aria-label={`Itens: ${quote.lines.map((line) => line.name).join(", ")}`}>
        {shown.map((line) => {
          const art = lineArtwork(line);
          return (
            <ItemDot key={line.id} style={{ "--item-hue": `var(--sys-${art.hue})` } as CSSProperties}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={catalogArtworkUrl(art)} alt="" width={24} height={24} loading="lazy" decoding="async" />
            </ItemDot>
          );
        })}
      </Dots>
      <Text as="span" variant="footnote" weight="medium">
        {total}
      </Text>
    </Items>
  );
}

/* A fila de bolinhas com o total ao lado, alinhada à direita como a coluna: a receita da coluna de
   orçamentos do catálogo, com a mesma sobreposição apertada. */
const Items = styled.span`
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: flex-end;
  white-space: nowrap;
`;

/* A fila em si, na receita do `AvatarGroup` da casa: a sobreposição e o anel moram aqui porque o grupo só os
   aplica em filhos com a classe do `Avatar`, que não é exportada, e estes são azulejos de item. O anel usa a
   superfície da tabela, e não o fundo da página, senão ele apareceria como um traço claro sobre a zebra. */
const Dots = styled.span`
  display: inline-flex;
  align-items: center;

  & > span + span {
    margin-inline-start: calc(var(--space-1) * -1);
  }

  & > span {
    box-shadow: 0 0 0 2px var(--table-surface, var(--color-bg));
  }
`;

/* A bolinha do item: o véu do matiz dele por fundo e a arte por cima, na medida do `Avatar` pequeno da casa.
   Redonda, e não squircle: círculo não passa pelo sistema de cantos, pela regra da casa, e a fila de
   bolinhas é redonda nas duas telas.

   A arte tem folga dentro da bolinha, como no azulejo do catálogo: as voltas do Loops encostam na borda do
   próprio desenho, e sem o recuo elas seriam cortadas pela curva. */
const ItemDot = styled.span`
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  overflow: hidden;
  background-color: light-dark(
    color-mix(in oklab, var(--item-hue) 12%, transparent),
    color-mix(in oklab, var(--item-hue) 18%, transparent)
  );
  border-radius: var(--radius-full);

  & > img {
    width: calc(100% - var(--space-1));
    height: calc(100% - var(--space-1));
  }
`;
