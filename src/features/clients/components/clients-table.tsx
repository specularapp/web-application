"use client";

import styled from "@emotion/styled";
import { StarIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
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
import { applyPattern } from "@/lib/masks";
import type { ClientListItem } from "../list-options";
import { ClientHoverCard } from "./client-hover-card";
import { ClientMenu } from "./client-menu";

export type ClientsTableProps = {
  clients: ClientListItem[];
  selected: string[];
  onSelectedChange: (selected: string[]) => void;
  onOpen: (client: ClientListItem) => void;
  onEdit: (client: ClientListItem) => void;
  /** A paginação, no pé da tabela. */
  footer?: ReactNode;
  range: { page: number; pageSize: number; total: number };
};

// A base de clientes em tabela, na mesma receita do catálogo (2026-09-08): densidade compacta, zebra,
// altura da tela com as linhas rolando por dentro e o cabeçalho preso, marcação por linha (a mesma seleção
// dos cartões, para excluir de uma vez), a coluna de ações presa na ponta. Colunas: a pessoa com a foto e a
// empresa ou o e-mail embaixo, e-mail, telefone com máscara, cidade, situação (com a estrela de favorito),
// orçamentos, projetos, faturado, desde quando e o leque. Ordena só por faturado, orçamentos e desde, pelo
// que está na página. A linha inteira abre a ficha; pelo teclado quem abre é o nome, e apontar o nome com o
// mouse abre a ficha resumida em vidro. O que falta (e-mail, telefone, cidade) é a etiqueta "Não condiz".
export function ClientsTable({ clients, selected, onSelectedChange, onOpen, onEdit, footer, range }: ClientsTableProps) {
  const columns: DataTableColumn<ClientListItem>[] = [
    {
      id: "name",
      header: "Cliente",
      cell: (client) => (
        <ClientHoverCard client={client}>
          <DataTableTitle
            title={client.name}
            caption={client.company ?? client.email ?? undefined}
            media={<Avatar name={client.name} src={client.avatarUrl ?? undefined} size="sm" shape="squircle" />}
            onClick={() => onOpen(client)}
          />
        </ClientHoverCard>
      ),
    },
    {
      id: "email",
      header: "E-mail",
      hideBelow: "lg",
      cell: (client) =>
        client.email ? (
          <Text as="span" variant="footnote" tone="secondary" truncate>
            {client.email}
          </Text>
        ) : (
          <DataTableEmptyValue />
        ),
    },
    {
      id: "phone",
      header: "Telefone",
      hideBelow: "md",
      cell: (client) =>
        client.phone ? (
          <Text as="span" variant="footnote" tone="secondary">
            {applyPattern("phone", client.phone)}
          </Text>
        ) : (
          <DataTableEmptyValue />
        ),
    },
    {
      id: "city",
      header: "Cidade",
      hideBelow: "lg",
      cell: (client) =>
        client.city ? (
          <Text as="span" variant="footnote" tone="secondary" truncate>
            {client.city}
          </Text>
        ) : (
          <DataTableEmptyValue />
        ),
    },
    {
      id: "status",
      header: "Situação",
      cell: (client) => (
        <StatusLine>
          <DataTableStatus tone={client.active ? "success" : "neutral"}>{client.active ? "Ativo" : "Inativo"}</DataTableStatus>
          {client.favorite && (
            <Badge tone="yellow" size="sm" icon={<StarIcon weight="fill" />}>
              Favorito
            </Badge>
          )}
        </StatusLine>
      ),
    },
    {
      id: "quotes",
      header: "Orçamentos",
      align: "end",
      sortable: true,
      sortValue: (client) => client.stats.quotes,
      hideBelow: "md",
      cell: (client) => (
        <Text as="span" variant="footnote" weight="medium">
          {client.stats.quotes}
        </Text>
      ),
    },
    {
      id: "projects",
      header: "Projetos",
      align: "end",
      hideBelow: "lg",
      cell: (client) => (
        <Text as="span" variant="footnote" weight="medium">
          {client.stats.projects}
        </Text>
      ),
    },
    {
      id: "billed",
      header: "Faturado",
      align: "end",
      sortable: true,
      sortValue: (client) => client.stats.billed,
      cell: (client) => <DataTableMoney cents={client.stats.billed} />,
    },
    {
      id: "createdAt",
      header: "Desde",
      sortable: true,
      sortValue: (client) => client.createdAt,
      hideBelow: "lg",
      cell: (client) => <DataTableDate iso={client.createdAt} />,
    },
  ];

  return (
    <DataTable
      label="Base de clientes"
      columns={columns}
      rows={clients}
      rowKey={(client) => client.id}
      density="compact"
      zebra
      fill
      selection={{ selected, onChange: onSelectedChange, rowLabel: (client) => `Selecionar ${client.name}` }}
      onRowClick={onOpen}
      actions={(client) => <ClientMenu client={client} onEdit={() => onEdit(client)} />}
      range={range}
      footer={footer}
    />
  );
}

/* A situação e a estrela lado a lado, numa linha só. */
const StatusLine = styled.span`
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
  white-space: nowrap;
`;
