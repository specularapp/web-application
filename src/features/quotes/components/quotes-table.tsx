"use client";

import styled from "@emotion/styled";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DataTable, DataTableDate, DataTableEmptyValue, DataTableMoney, DataTableTitle, type DataTableColumn } from "@/components/ui/data-table";
import { Text } from "@/components/ui/text";
import { CatalogArtwork } from "@/features/catalog/components/catalog-artwork";
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

/* Quantas artes de item a coluna mostra antes de resumir o resto em "+N". Três, como nos cartões da casa. */
const SHOWN_ITEMS = 3;

/* Os itens do orçamento pelas artes deles (2026-09-10, a pedido, no lugar da contagem em texto): as mesmas
   artes que o documento desenha, sobrepostas na fila do `AvatarGroup`, com "+N" no fim quando há mais do que
   cabe. A leitura por voz recebe a lista de nomes, que é o que a arte não diz. */
function QuoteItems({ quote }: { quote: Quote }) {
  const shown = quote.lines.slice(0, SHOWN_ITEMS);
  const rest = quote.lines.length - shown.length;
  if (shown.length === 0) return <DataTableEmptyValue />;

  return (
    <Items aria-label={`Itens: ${quote.lines.map((line) => line.name).join(", ")}`}>
      {shown.map((line) => (
        <Artwork key={line.id} item={lineArtwork(line)} size="sm" />
      ))}
      {rest > 0 && (
        <Rest as="span" variant="caption1" tone="secondary">
          +{rest}
        </Rest>
      )}
    </Items>
  );
}

/* A fila de artes com o "+N" ao lado, alinhada à direita como a coluna. As artes se sobrepõem de leve, na
   receita da fila de rostos da casa, com o anel na cor da superfície separando uma da outra.

   A sobreposição é feita aqui, e não pelo `AvatarGroup`: ele só a aplica em filhos com a classe do `Avatar`,
   e estes são azulejos do catálogo. O anel usa a superfície da tabela, e não o fundo da página, senão ele
   aparecia como um traço claro sobre a linha zebrada. */
const Items = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  white-space: nowrap;

  & > span + span {
    margin-inline-start: calc(var(--space-1) * -1);
  }
`;

/* A arte encolhe para caber na linha da densidade compacta: o `sm` do primitivo tem 32px e a linha tem 36, e
   na medida cheia as artes encostavam nas bordas da célula. As variáveis vão no próprio azulejo, e não
   herdadas da fila, porque o `data-size` dele as redeclara no elemento e isso vence a herança do pai. */
const Artwork = styled(CatalogArtwork)`
  --artwork-size: 1.5rem;
  --artwork-inset: 0.25rem;

  /* O anel na superfície da tabela separa uma arte da outra na sobreposição. A superfície, e não o fundo da
     página: sobre a linha zebrada o fundo aparecia como um traço claro. */
  box-shadow: 0 0 0 2px var(--table-surface, var(--color-bg));
`;

/* O "+N" fecha a fila, fora da sobreposição das artes. */
const Rest = styled(Text)`
  margin-inline-start: var(--space-2);
`;
