"use client";

import styled from "@emotion/styled";
import { CheckIcon } from "@phosphor-icons/react";
import { memo, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DataTable, DataTableDate, DataTableEmptyValue, DataTableMoney, DataTableTitle, type DataTableColumn } from "@/components/ui/data-table";
import { Text } from "@/components/ui/text";
import { contractKinds, contractStatuses, dateOf } from "../labels";
import type { Contract } from "../summary";
import { ContractMenu } from "./contract-menu";
import type { ContractActionsFor } from "./contracts-funnel";

export type ContractsTableProps = {
  contracts: Contract[];
  actionsFor: ContractActionsFor;
  /** A paginação, no pé da tabela. */
  footer?: ReactNode;
  range: { page: number; pageSize: number; total: number };
};

// Os contratos em tabela (2026-10-26, a pedido: "o modo tabela"), no desenho das tabelas da casa, ao lado do
// funil por etapas. Colunas: o contrato (título e código), o cliente com a foto e a empresa, o tipo na etiqueta
// colorida, a situação com o glifo, o valor, as assinaturas (quem já assinou ganha o check), a data que importa
// na situação, quem responde e o leque. Ordena por valor e por criação. A linha inteira abre a ficha; pelo
// teclado quem abre é o título.
function ContractsTableBase({ contracts, actionsFor, footer, range }: ContractsTableProps) {
  const columns: DataTableColumn<Contract>[] = [
    {
      id: "title",
      header: "Contrato",
      cell: (contract) => <DataTableTitle title={contract.title} caption={contract.reference} onClick={actionsFor(contract).onOpen} />,
    },
    {
      id: "client",
      header: "Cliente",
      hideBelow: "md",
      cell: (contract) =>
        contract.client ? (
          <DataTableTitle
            title={contract.client.company ?? contract.client.name}
            caption={contract.client.company ? contract.client.name : undefined}
            media={<Avatar name={contract.client.name} src={contract.client.avatarUrl ?? undefined} size="xs" />}
          />
        ) : (
          <DataTableEmptyValue />
        ),
    },
    {
      id: "kind",
      header: "Tipo",
      hideBelow: "lg",
      cell: (contract) => {
        const kind = contractKinds[contract.kind];
        return (
          <Badge size="sm" hue={kind.hue}>
            {kind.label}
          </Badge>
        );
      },
    },
    {
      id: "status",
      header: "Situação",
      cell: (contract) => {
        const status = contractStatuses[contract.status];
        return (
          <Badge tone={status.tone} size="sm" icon={<status.icon />}>
            {status.label}
          </Badge>
        );
      },
    },
    {
      id: "amount",
      header: "Valor",
      align: "end",
      sortable: true,
      sortValue: (contract) => contract.amount ?? -1,
      cell: (contract) =>
        contract.amount === null ? (
          <Text as="span" variant="footnote" tone="tertiary">
            A combinar
          </Text>
        ) : (
          <DataTableMoney cents={contract.amount} size="lg" />
        ),
    },
    {
      id: "parties",
      header: "Assinaturas",
      hideBelow: "md",
      cell: (contract) => <Signatures contract={contract} />,
    },
    {
      id: "date",
      header: "Prazo",
      hideBelow: "lg",
      cell: (contract) => {
        const date = dateOf(contract);
        return (
          <Badge tone={date.tone} size="sm">
            {date.label}
          </Badge>
        );
      },
    },
    {
      id: "createdAt",
      header: "Criado em",
      sortable: true,
      sortValue: (contract) => contract.createdAt,
      hideBelow: "lg",
      cell: (contract) => <DataTableDate iso={contract.createdAt} />,
    },
    {
      id: "owner",
      header: "Responsável",
      hideBelow: "lg",
      cell: (contract) => (
        <Person>
          <Avatar name={contract.owner.name} src={contract.owner.avatarUrl ?? undefined} size="xs" aria-hidden="true" />
          <Text as="span" variant="footnote" truncate>
            {contract.owner.name}
          </Text>
        </Person>
      ),
    },
  ];

  return (
    <DataTable
      label="Contratos"
      columns={columns}
      rows={contracts}
      rowKey={(contract) => contract.id}
      fill
      onRowClick={(contract) => actionsFor(contract).onOpen()}
      actions={(contract) => <ContractMenu contract={contract} {...actionsFor(contract)} />}
      range={range}
      footer={footer}
    />
  );
}

/* Memorizada: sem isto, cada tecla no campo de busca refazia a tabela inteira antes de a espera deixar a busca
   nova ir ao servidor. */
export const ContractsTable = memo(ContractsTableBase);

/* As partes em bolinha, com o check de quem já assinou, e a conta ao lado: "1 de 2". */
function Signatures({ contract }: { contract: Contract }) {
  const signed = contract.parties.filter((party) => party.signedAt).length;
  return (
    <Faces aria-label={contract.parties.map((party) => `${party.name}: ${party.signedAt ? "assinou" : "ainda não assinou"}`).join(", ")}>
      <span data-role="row">
        {contract.parties.map((party) => (
          <span key={party.id} data-role="face">
            <Avatar name={party.name} src={party.avatarUrl ?? undefined} size="xs" aria-hidden="true" />
            {party.signedAt && (
              <span data-role="mark">
                <CheckIcon weight="bold" />
              </span>
            )}
          </span>
        ))}
      </span>
      <Text as="span" variant="footnote" tone="secondary">
        {signed} de {contract.parties.length}
      </Text>
    </Faces>
  );
}

/* Quem responde: a bolinha pequena e o nome numa linha só. */
const Person = styled.span`
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  min-width: 0;
  white-space: nowrap;
`;

/* A fila de rostos na receita do `AvatarGroup`, com o anel na superfície da tabela, e o check verde na quina
   de quem já assinou, como no cartão. */
const Faces = styled.span`
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  white-space: nowrap;

  & > [data-role="row"] {
    display: inline-flex;
    align-items: center;
  }

  & [data-role="face"] {
    position: relative;
    display: inline-flex;
    border-radius: var(--radius-full);
    box-shadow: 0 0 0 2px var(--table-surface, var(--color-bg));
  }

  & [data-role="face"] + [data-role="face"] {
    margin-inline-start: calc(var(--space-1) * -1);
  }

  & [data-role="mark"] {
    position: absolute;
    inset-block-end: -0.125rem;
    inset-inline-end: -0.125rem;
    display: grid;
    place-items: center;
    width: 0.75rem;
    height: 0.75rem;
    color: var(--color-on-accent);
    background-color: var(--color-success);
    border-radius: var(--radius-full);
    box-shadow: 0 0 0 1.5px var(--table-surface, var(--color-bg));
  }

  & [data-role="mark"] svg {
    width: 0.5rem;
    height: 0.5rem;
  }
`;
