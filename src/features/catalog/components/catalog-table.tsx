"use client";

import styled from "@emotion/styled";
import { useState, type ReactNode } from "react";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  DataTableDate,
  DataTableEmptyValue,
  DataTableMoney,
  DataTableStatus,
  DataTableTitle,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { Text } from "@/components/ui/text";
import { kindLabels, kindTones, readStock, UNLIMITED_STOCK, unitLabels } from "../list-options";
import type { CatalogItem } from "../summary";
import { CatalogArtwork } from "./catalog-artwork";
import { CatalogHoverCard } from "./catalog-hover-card";
import { CatalogMenu } from "./catalog-menu";

export type CatalogTableProps = {
  items: CatalogItem[];
  isActive: (item: CatalogItem) => boolean;
  onActiveChange: (item: CatalogItem) => (active: boolean) => void;
  onOpen: (item: CatalogItem) => void;
  onEdit: (item: CatalogItem) => void;
  /** A paginação, no pé da tabela. */
  footer?: ReactNode;
  range: { page: number; pageSize: number; total: number };
};

const durationLabel = ({ min, max }: { min: number; max: number }) => (min === max ? `${min} dias` : `${min} a ${max} dias`);

/* A forma de cobrança encurtada para caber na linha fina: "por projeto" vira "/projeto". */
const unitShort: Record<CatalogItem["unit"], string> = {
  project: "/projeto",
  hour: "/hora",
  month: "/mês",
  unit: "/un.",
};

// O catálogo em tabela, a visão de quem quer comparar muitos itens de uma vez, na densidade compacta e com
// marcação por linha, como a referência: quem cadastrou (antes do item, a pedido), a identidade com a arte, o tipo, o preço com a cobrança na mesma
// linha, o estoque (só produto tem), o prazo (só serviço tem), a situação, quantas vezes entrou em orçamento
// (as bolinhas dos clientes e o total), desde quando está no catálogo e o leque. Estoque é "48/100" e, sem
// limite, "∞/∞"; prazo sem número é "Indeterminado"; item sem orçamento é a etiqueta "Não condiz". A linha inteira abre a ficha; pelo teclado
// quem abre é o nome, e apontar o nome com o mouse abre a ficha resumida em vidro. Ordena só por preço,
// orçamentos e desde (a pedido), pelo que está na página: a ordem da base inteira, no servidor, entra
// quando a tabela vier do banco. A marcação ainda não tem ação em lote; ela mostra a contagem no pé e é o
// gancho para excluir e desativar vários de uma vez.
export function CatalogTable({ items, isActive, onActiveChange, onOpen, onEdit, footer, range }: CatalogTableProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const columns: DataTableColumn<CatalogItem>[] = [
    {
      id: "createdBy",
      header: "Criado por",
      hideBelow: "lg",
      cell: (item) => (
        <Person>
          <Avatar name={item.createdBy} size="xs" aria-hidden="true" />
          <Text as="span" variant="footnote" truncate>
            {item.createdBy}
          </Text>
        </Person>
      ),
    },
    {
      id: "name",
      header: "Item",
      cell: (item) => (
        <CatalogHoverCard item={item} active={isActive(item)}>
          <DataTableTitle title={item.name} caption={item.category} media={<CatalogArtwork item={item} size="sm" />} onClick={() => onOpen(item)} />
        </CatalogHoverCard>
      ),
    },
    {
      id: "kind",
      header: "Tipo",
      hideBelow: "md",
      cell: (item) => (
        <Badge tone={kindTones[item.kind]} size="sm">
          {kindLabels[item.kind]}
        </Badge>
      ),
    },
    {
      id: "price",
      header: "Preço",
      align: "end",
      sortable: true,
      sortValue: (item) => item.price,
      cell: (item) => (
        <PriceLine>
          <DataTableMoney cents={item.price} />
          <Text as="span" variant="caption1" tone="tertiary" title={unitLabels[item.unit]}>
            {unitShort[item.unit]}
          </Text>
        </PriceLine>
      ),
    },
    {
      id: "stock",
      header: "Estoque",
      hideBelow: "md",
      cell: (item) => {
        const stock = readStock(item);
        if (!stock) return <Badge size="sm">{UNLIMITED_STOCK}</Badge>;
        return (
          <Badge tone={stock.tone} size="sm">
            {stock.short}
          </Badge>
        );
      },
    },
    {
      id: "duration",
      header: "Prazo",
      hideBelow: "lg",
      cell: (item) => <Badge size="sm">{item.duration ? durationLabel(item.duration) : "Indeterminado"}</Badge>,
    },
    {
      id: "status",
      header: "Situação",
      cell: (item) => <DataTableStatus tone={isActive(item) ? "success" : "neutral"}>{isActive(item) ? "Ativo" : "Inativo"}</DataTableStatus>,
    },
    {
      id: "quotes",
      header: "Orçamentos",
      align: "end",
      sortable: true,
      sortValue: (item) => item.stats.quotes,
      hideBelow: "md",
      cell: (item) => <QuoteClients item={item} />,
    },
    {
      id: "createdAt",
      header: "Desde",
      sortable: true,
      sortValue: (item) => item.createdAt,
      hideBelow: "lg",
      cell: (item) => <DataTableDate iso={item.createdAt} />,
    },
  ];

  const foot =
    selected.length > 0 || footer ? (
      <Foot>
        {selected.length > 0 && (
          <Text as="span" variant="footnote" weight="medium">
            {selected.length === 1 ? "1 selecionado" : `${selected.length} selecionados`}
          </Text>
        )}
        {footer}
      </Foot>
    ) : undefined;

  return (
    <DataTable
      label="Base do catálogo"
      columns={columns}
      rows={items}
      rowKey={(item) => item.id}
      density="compact"
      zebra
      fill
      selection={{ selected, onChange: setSelected, rowLabel: (item) => `Selecionar ${item.name}` }}
      onRowClick={onOpen}
      actions={(item) => <CatalogMenu item={item} active={isActive(item)} onActiveChange={onActiveChange(item)} onView={() => onOpen(item)} onEdit={() => onEdit(item)} />}
      range={range}
      footer={foot}
    />
  );
}

/* Valor e complemento na mesma linha, alinhados à direita como a coluna: o preço com a cobrança, a contagem
   com a aprovação. Uma linha só é o que mantém a linha da tabela fina. */
const PriceLine = styled.span`
  display: inline-flex;
  gap: var(--space-1);
  align-items: baseline;
  justify-content: flex-end;
  white-space: nowrap;
`;

/* Até quatro clientes que já receberam orçamento com o item, nas bolinhas da casa, e o total ao lado: quem
   compra o item se lê de uma vez, sem abrir a ficha. Os rostos vêm dos orçamentos recentes da ficha, um por
   cliente, e o total é o da base inteira, que pode passar dos rostos à vista. */
const SHOWN_CLIENTS = 4;

function QuoteClients({ item }: { item: CatalogItem }) {
  const total = item.stats.quotes;
  if (total === 0) return <DataTableEmptyValue />;
  const clients = Array.from(new Set(item.quotes.map((quote) => quote.client))).slice(0, SHOWN_CLIENTS);
  return (
    <Clients>
      {clients.length > 0 && (
        <AvatarGroup aria-label={`Clientes: ${clients.join(", ")}`}>
          {clients.map((client) => (
            <Avatar key={client} name={client} size="xs" />
          ))}
        </AvatarGroup>
      )}
      <Text as="span" variant="footnote" weight="medium">
        {total}
      </Text>
    </Clients>
  );
}

const Clients = styled.span`
  --avatar-overlap: var(--space-1);

  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: flex-end;
  white-space: nowrap;
`;

/* Quem cadastrou: a bolinha pequena e o nome numa linha só; o nome cede por reticências. */
const Person = styled.span`
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  min-width: 0;
  white-space: nowrap;
`;

const Foot = styled.span`
  display: inline-flex;
  gap: var(--space-4);
  align-items: center;
`;
