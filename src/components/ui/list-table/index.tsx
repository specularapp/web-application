"use client";

import { ArrowDownIcon, ArrowUpIcon, CaretUpDownIcon } from "@phosphor-icons/react";
import { useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef, type CSSProperties, type ReactNode, type UIEvent } from "react";
import { cx } from "@/lib/utils/cx";
import { Checkbox } from "../checkbox";
import styles from "./list-table.module.css";

export type ListTableSortDirection = "asc" | "desc";

export type ListTableSort = { id: string; direction: ListTableSortDirection };

export type ListTableColumn<Row> = {
  id: string;
  /** O título da coluna, e o nome dela para o leitor de tela. */
  header: string;
  title?: string;
  cell: (row: Row) => ReactNode;
  /** Com isto o cabeçalho vira o botão que ordena por esta coluna. */
  sortable?: boolean;
  /** A direção em que a coluna começa quando é escolhida: texto de A a Z, número e data do maior ou mais novo. */
  firstDirection?: ListTableSortDirection;
  align?: "start" | "center" | "end";
  /** Largura fixa da coluna, em qualquer unidade de CSS; sem ela a coluna toma o que o conteúdo pede. */
  width?: string;
  /** Coluna que sai nas telas estreitas, para as que importam caberem sem rolar. */
  hideBelow?: "md" | "lg";
  /** Tinta secundária, para o dado que acompanha e não protagoniza (telefone, datas). */
  muted?: boolean;
  /** A coluna que gruda à direita ao rolar para o lado: a das ações da linha (2026-10-27). */
  pinnedEnd?: boolean;
};

export type ListTableSelection<Row> = {
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  /** O nome da caixa de uma linha para o leitor de tela, como "Selecionar Camila". */
  label: (row: Row) => string;
};

export type ListTableProps<Row> = {
  /** O nome da tabela para o leitor de tela. */
  label: string;
  rows: readonly Row[];
  rowId: (row: Row) => string;
  columns: readonly ListTableColumn<Row>[];
  sort?: ListTableSort | null;
  onSortChange?: (next: ListTableSort) => void;
  className?: string;
  tableClassName?: string;
  rowProps?: (row: Row) => ComponentPropsWithoutRef<"tr"> & { [key: `data-${string}`]: string | number | boolean | undefined };
  selection?: ListTableSelection<Row>;
  /** Quantas linhas aparecem no título da coluna fixada, como "Cliente (14)". */
  count?: number;
  /** O que ocupa o corpo quando não há linha: o vazio da lista, com a saída (limpar a busca). */
  empty: ReactNode;
};

/** Até onde a entrada em cascata escalona: depois da linha 16 todas entram juntas, senão a lista longa demora. */
const STAGGER_LIMIT = 15;

/**
 * A tabela das listas de trabalho, trazida do sistema da pousada (2026-10-26, a pedido: "pegar a tabela que tem
 * lá e trazer para cá"): cabeçalho de 36px preso no topo, linhas de 40px, fio vertical entre as colunas, a
 * seleção e a coluna que identifica a linha coladas à esquerda (com um fio que só aparece quando a tabela rola
 * para o lado), o tom do mouse e o da seleção opacos para cobrir o que passa por baixo, e as linhas entrando em
 * cascata. Quem manda no dado é quem chama; a tabela só desenha, ordena por clique no cabeçalho e marca a
 * seleção.
 *
 * Mora ao lado da `DataTable` da casa, que segue nas outras listas: esta é a do desenho da pousada, usada onde
 * a lista precisa ler como a de lá (o funil de vendas).
 */
export function ListTable<Row>({ label, rows, rowId, columns, sort, onSortChange, selection, count, empty, className, tableClassName, rowProps }: ListTableProps<Row>) {
  const [scrolled, setScrolled] = useState(false);
  /* Se ainda há coluna escondida à direita: é o que acende o fio na borda da coluna de ações presa ali. */
  const [moreRight, setMoreRight] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const measure = (element: HTMLDivElement) => {
    const nextScrolled = element.scrollLeft > 0;
    const nextRight = element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
    setScrolled((current) => (current === nextScrolled ? current : nextScrolled));
    setMoreRight((current) => (current === nextRight ? current : nextRight));
  };

  const onScroll = (event: UIEvent<HTMLDivElement>) => measure(event.currentTarget);

  /* A medida também vale sem rolagem nenhuma: na primeira pintura e quando a janela muda de largura, a tabela
     pode passar a caber ou deixar de caber. */
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    measure(element);
    const observer = new ResizeObserver(() => measure(element));
    observer.observe(element);
    return () => observer.disconnect();
  }, [rows.length, columns.length]);

  /* A primeira coluna é a que gruda à esquerda, em toda tabela (2026-10-27, a pedido: "faça a primeira coluna
     ficar fixa e a coluna de ação também"), e a das ações gruda à direita. */
  const pinStart = (index: number) => index === 0;

  const selectedRows = selection ? rows.filter((row) => selection.selected.has(rowId(row))) : [];
  const allSelected = rows.length > 0 && selectedRows.length === rows.length;

  // Marcar todos age só no que está na tela: com um filtro ligado, o que ficou escondido não entra na conta.
  const toggleAll = () => {
    if (!selection) return;
    const next = new Set(selection.selected);
    for (const row of rows) {
      if (allSelected) next.delete(rowId(row));
      else next.add(rowId(row));
    }
    selection.onChange(next);
  };

  const toggleRow = (id: string) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selection.onChange(next);
  };

  const sortBy = (column: ListTableColumn<Row>) =>
    onSortChange?.(
      sort?.id === column.id
        ? { id: column.id, direction: sort.direction === "asc" ? "desc" : "asc" }
        : { id: column.id, direction: column.firstDirection ?? "desc" },
    );

  const span = columns.length + (selection ? 1 : 0);

  return (
    <div ref={scroller} className={cx(styles.scroll, className)} data-list-scroll="" data-scrolled={scrolled || undefined} data-more-right={moreRight || undefined} onScroll={onScroll}>
      <table className={cx(styles.table, tableClassName)} aria-label={label} style={{ "--pin-left": selection ? "var(--check-width)" : "0px" } as CSSProperties}>
        <thead>
          <tr>
            {selection && (
              <th className={cx(styles.th, styles.check)} data-pin="check" scope="col">
                <Checkbox
                  aria-label="Selecionar todos"
                  checked={allSelected}
                  indeterminate={selectedRows.length > 0 && !allSelected}
                  onChange={toggleAll}
                />
              </th>
            )}
            {columns.map((column, index) => {
              const active = sort?.id === column.id;
              const start = pinStart(index);
              return (
                <th
                  key={column.id}
                  className={styles.th}
                  scope="col"
                  title={column.title}
                  data-col={column.id}
                  data-align={column.align}
                  data-hide={column.hideBelow}
                  data-pin={start ? "name" : column.pinnedEnd ? "end" : undefined}
                  data-edge={start ? "" : undefined}
                  style={column.width ? { width: column.width, minWidth: column.width } : undefined}
                  aria-sort={column.sortable && onSortChange ? (active ? (sort?.direction === "asc" ? "ascending" : "descending") : "none") : undefined}
                >
                  {column.sortable && onSortChange ? (
                    <button type="button" className={styles.sort} data-active={active || undefined} onClick={() => sortBy(column)}>
                      {column.header}
                      {start && count !== undefined && <span className={styles.count}>({count})</span>}
                      {active ? (
                        sort?.direction === "asc" ? (
                          <ArrowUpIcon aria-hidden="true" />
                        ) : (
                          <ArrowDownIcon aria-hidden="true" />
                        )
                      ) : (
                        <CaretUpDownIcon aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 && (
            <tr>
              <td className={styles.empty} colSpan={span}>
                {empty}
              </td>
            </tr>
          )}

          {rows.map((row, index) => {
            const id = rowId(row);
            const attributes = rowProps?.(row);
            const isSelected = selection?.selected.has(id) ?? false;
            return (
              <tr
                key={id}
                {...attributes}
                className={cx(styles.row, attributes?.className)}
                data-clickable={attributes?.onClick ? "" : undefined}
                data-selected={isSelected || undefined}
                style={{ "--i": Math.min(index, STAGGER_LIMIT), ...attributes?.style } as CSSProperties}
              >
                {selection && (
                  // Marcar a caixa não aciona o clique da linha (que costuma abrir o item)
                  <td className={cx(styles.cell, styles.check)} data-pin="check" onClick={(event) => event.stopPropagation()}>
                    <Checkbox aria-label={selection.label(row)} checked={isSelected} onChange={() => toggleRow(id)} />
                  </td>
                )}
                {columns.map((column, index) => (
                  <td
                    key={column.id}
                    className={styles.cell}
                    data-col={column.id}
                    data-label={column.header}
                    data-align={column.align}
                    data-hide={column.hideBelow}
                    data-muted={column.muted || undefined}
                    data-pin={pinStart(index) ? "name" : column.pinnedEnd ? "end" : undefined}
                    data-edge={pinStart(index) ? "" : undefined}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
