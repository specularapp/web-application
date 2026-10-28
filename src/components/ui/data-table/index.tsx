"use client";

import styled from "@emotion/styled";
import { CalendarBlankIcon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Route } from "next";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { formatMoney } from "@/lib/utils/format";
import { Badge, type BadgeTone } from "../badge";
import { PagedBody } from "../list-pagination";
import { ListTable, type ListTableColumn, type ListTableSort } from "../list-table";
import { Skeleton } from "../skeleton";
import { Text } from "../text";
import styles from "./data-table.module.css";

export type DataTableAlign = "start" | "center" | "end";

export type DataTableSortDirection = "asc" | "desc";

export type DataTableSort = { column: string; direction: DataTableSortDirection };

export type DataTableColumn<Row> = {
  id: string;
  header: string;
  align?: DataTableAlign;
  /** Largura fixa da coluna, em qualquer unidade de CSS; sem ela a coluna toma o que o conteúdo pede. */
  width?: string;
  /** Ordenável pelo cabeçalho. Com `sortValue` a tabela ordena sozinha o que recebeu; sem ele, só avisa. */
  sortable?: boolean;
  sortValue?: (row: Row) => string | number | null;
  /** Coluna que sai nas telas estreitas, para as que importam caberem sem rolar. */
  hideBelow?: "md" | "lg";
  cell: (row: Row) => ReactNode;
};

export type DataTableSelection<Row> = {
  selected: string[];
  onChange: (selected: string[]) => void;
  /** O nome da caixa de cada linha para leitor de tela, como "Selecionar Landing page". */
  rowLabel: (row: Row) => string;
};

/** De qual até qual linha a página mostra, para o pé dizer "Mostrando 1 a 12 de 342". */
export type DataTableRange = { page: number; pageSize: number; total: number };

export type DataTableProps<Row> = {
  /** Nome da tabela para leitor de tela e para a região que rola. */
  label: string;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** Com ela, a primeira coluna são as caixas de marcar, com marcar tudo no cabeçalho. */
  selection?: DataTableSelection<Row>;
  /** A ordem em vigor, controlada por quem chama; sem ela a tabela guarda a própria. */
  sort?: DataTableSort | null;
  defaultSort?: DataTableSort;
  onSortChange?: (sort: DataTableSort | null) => void;
  /** A linha inteira abre algo ao clique. Pelo teclado quem abre é a célula principal, um botão ou link
   *  de verdade via `DataTableTitle`: linha clicável sem foco próprio deixaria a tabela sem teclado. */
  onRowClick?: (row: Row) => void;
  /** O que fica na última coluna, alinhado ao fim: o leque de opções, os botões da linha. */
  actions?: (row: Row) => ReactNode;
  loading?: boolean;
  loadingRows?: number;
  /** O que aparece no lugar das linhas quando não há nenhuma. */
  empty?: ReactNode;
  /** As páginas, que flutuam numa pílula no pé da tabela. */
  footer?: ReactNode;
  /** Aceita e ignora: a faixa "1–50 de N" mora na própria paginação. */
  range?: DataTableRange;
  /** Enche a altura de quem a monta e rola as linhas por dentro, com o pé sempre à vista. */
  fill?: boolean;
};

/* Controles com ação própria dentro da linha: clique que nasce neles não abre a linha. */
const INTERACTIVE = "button, a, input, label, [role='button'], [role='menuitem'], [role='checkbox']";

/* Nulo e indefinido vão para o fim em qualquer direção; número com número, o resto como texto em pt-BR. */
function compare(a: string | number | null, b: string | number | null) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true });
}

// A tabela de dados da casa, para toda lista que precise ler em linhas, **no desenho da tabela trazida do
// sistema da pousada** (2026-10-26, a pedido: "padronize a tabela de todo o sistema"): quem desenha é a
// `ListTable` (cabeçalho de 36px preso, linhas de 40px, fio entre as colunas, tom do mouse opaco, linhas em
// cascata), na moldura de fio fino e canto `lg`, e as páginas do pé flutuam numa pílula (`PagedBody`). A API é
// a de sempre, para as listas da casa não mudarem: colunas declaradas por quem chama, ordem pelo cabeçalho (com
// `sortValue` ela ordena sozinha), marcação com marcar tudo, linha clicável, coluna de ações, esqueleto de
// carga e vazio. Densidade e zebra deixaram de existir no desenho: toda tabela tem a mesma medida.
//
// A aparência das células fica com quem chama, pelos ajudantes deste módulo (`DataTableTitle`,
// `DataTableStatus`, `DataTableTags`, `DataTableDate`, `DataTableMoney`).
export function DataTable<Row>({
  label,
  columns,
  rows,
  rowKey,
  selection,
  sort,
  defaultSort,
  onSortChange,
  onRowClick,
  actions,
  loading = false,
  loadingRows = 6,
  empty,
  footer,
  fill = false,
}: DataTableProps<Row>) {
  // A ordem é de quem chama quando ele a passa; senão a tabela guarda a própria, começando pelo padrão.
  const [ownSort, setOwnSort] = useState<DataTableSort | null>(defaultSort ?? null);
  const activeSort = sort === undefined ? ownSort : sort;

  const changeSort = (next: ListTableSort) => {
    const mapped: DataTableSort = { column: next.id, direction: next.direction };
    if (sort === undefined) setOwnSort(mapped);
    onSortChange?.(mapped);
  };

  const sortColumn = activeSort ? columns.find((column) => column.id === activeSort.column) : undefined;
  const sortValue = sortColumn?.sortValue;
  const sorted =
    activeSort && sortValue
      ? [...rows].sort((a, b) => compare(sortValue(a), sortValue(b)) * (activeSort.direction === "asc" ? 1 : -1))
      : rows;

  const listColumns: ListTableColumn<Row>[] = [
    ...columns.map(
      (column): ListTableColumn<Row> => ({
        id: column.id,
        header: column.header,
        align: column.align,
        width: column.width,
        hideBelow: column.hideBelow,
        sortable: column.sortable,
        firstDirection: "asc",
        cell: column.cell,
      }),
    ),
    ...(actions
      ? [
          {
            id: "actions",
            header: "Ações",
            align: "end" as const,
            pinnedEnd: true,
            cell: (row: Row) => <span className={styles.actions}>{actions(row)}</span>,
          },
        ]
      : []),
  ];

  const nothing = loading ? (
    <span className={styles.loading} aria-busy="true" aria-label="Carregando">
      {Array.from({ length: loadingRows }, (_, index) => (
        <Skeleton key={index} width={index % 2 === 0 ? "70%" : "45%"} />
      ))}
    </span>
  ) : (
    (empty ?? (
      <Text variant="footnote" tone="secondary">
        Nada por aqui
      </Text>
    ))
  );

  return (
    <div className={styles.frame} data-fill={fill || undefined}>
      <PagedBody pager={footer}>
        <ListTable<Row>
          label={label}
          rows={loading ? [] : sorted}
          rowId={rowKey}
          columns={listColumns}
          sort={activeSort ? { id: activeSort.column, direction: activeSort.direction } : null}
          onSortChange={changeSort}
          selection={
            selection
              ? {
                  selected: new Set(selection.selected),
                  onChange: (next) => selection.onChange([...next]),
                  label: selection.rowLabel,
                }
              : undefined
          }
          rowProps={
            onRowClick
              ? (row) => ({
                  /* O leque da linha abre em portal: clique que nasce num controle, ou fora da linha no DOM, não
                     abre a linha. */
                  onClick: (event) => {
                    const target = event.target as HTMLElement;
                    if (!event.currentTarget.contains(target) || target.closest(INTERACTIVE)) return;
                    onRowClick(row);
                  },
                })
              : undefined
          }
          empty={<div className={styles.empty}>{nothing}</div>}
        />
      </PagedBody>
    </div>
  );
}

/* A célula de identidade: a foto ou a arte, o título e a legenda. O título é botão ou link de verdade quando
   a linha abre algo, porque é por ele que o teclado entra. */
/* O vão de 8px da célula de identidade da lista da pousada: a foto é a pequena, na medida do responsável. */
const TitleCell = styled.span`
  display: flex;
  gap: var(--space-2);
  align-items: center;
  min-width: 0;
`;

const TitleCopy = styled.span`
  display: grid;
  min-width: 0;
`;

const titleReset = `
  display: block;
  min-width: 0;
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  font-family: var(--font-body);
  font-size: var(--text-footnote);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-tight);
  color: var(--color-label);
  text-align: start;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;

  @media (hover: hover) {
    &:hover {
      text-decoration: underline;
    }

    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
      border-radius: var(--radius-xs);
    }
  }
`;

const TitleButton = styled.button`
  ${titleReset}
`;

const TitleLink = styled(Link)`
  ${titleReset}
`;

export type DataTableTitleProps = {
  title: string;
  caption?: string;
  /** A foto, o avatar ou a arte, no tamanho da linha. */
  media?: ReactNode;
  onClick?: () => void;
  href?: Route;
};

export function DataTableTitle({ title, caption, media, onClick, href }: DataTableTitleProps) {
  return (
    <TitleCell>
      {media}
      <TitleCopy>
        {onClick ? (
          <TitleButton type="button" aria-haspopup="dialog" onClick={onClick}>
            {title}
          </TitleButton>
        ) : href ? (
          <TitleLink href={href}>{title}</TitleLink>
        ) : (
          <Text as="span" variant="footnote" weight="medium" truncate>
            {title}
          </Text>
        )}
        {caption && (
          <Text as="span" variant="caption1" tone="secondary" truncate>
            {caption}
          </Text>
        )}
      </TitleCopy>
    </TitleCell>
  );
}

/** A situação na etiqueta pequena da casa, sem ponto: a cor do texto e do fundo já dizem o estado. */
export function DataTableStatus({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <Badge tone={tone} size="sm">
      {children}
    </Badge>
  );
}

const TagsRow = styled.span`
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
  white-space: nowrap;
`;

/** Etiquetas em fila, as primeiras à vista e o resto numa contagem, para a linha não crescer. */
export function DataTableTags({ items, max = 3 }: { items: string[]; max?: number }) {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <TagsRow>
      {shown.map((item) => (
        <Badge key={item} size="sm">
          {item}
        </Badge>
      ))}
      {rest > 0 && (
        <Badge size="sm" variant="outline" title={items.slice(max).join(", ")}>
          +{rest}
        </Badge>
      )}
    </TagsRow>
  );
}

const DateCell = styled.span`
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
  white-space: nowrap;
  color: var(--color-label-secondary);

  & svg {
    flex-shrink: 0;
    width: 0.875rem;
    height: 0.875rem;
    color: var(--color-label-tertiary);
  }
`;

/** Uma data com o glifo do calendário na frente, em `d MMM. yyyy`. */
export function DataTableDate({ iso }: { iso: string }) {
  return (
    <DateCell>
      <CalendarBlankIcon aria-hidden="true" />
      <Text as="span" variant="footnote" tone="inherit">
        {format(parseISO(iso), "d MMM. yyyy", { locale: ptBR })}
      </Text>
    </DateCell>
  );
}

/**
 * Dinheiro em centavos, por extenso e em algarismos tabulares, para as colunas alinharem à direita. O
 * tamanho `lg` sobe um degrau na escala (2026-09-10, a pedido, no total do orçamento): numa tabela em que o
 * valor é o que se compara ao correr a lista, ele lê melhor um pouco maior que o resto da linha.
 */
export function DataTableMoney({ cents, weight = "semibold", size = "md" }: { cents: number; weight?: "medium" | "semibold"; size?: "md" | "lg" }) {
  return (
    <Text as="span" variant={size === "lg" ? "subheadline" : "footnote"} weight={weight}>
      {formatMoney(cents)}
    </Text>
  );
}

/** Campo sem nada, ou que não se aplica ao item, diz isso em palavras na etiqueta neutra: a coluna não
 *  fica vazia nem parece quebrada, e lê igual em toda tabela da casa. */
export function DataTableEmptyValue() {
  return <Badge size="sm">Não condiz</Badge>;
}
