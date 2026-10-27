"use client";

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { IconButton } from "../icon-button";
import { Select } from "../select";
import styles from "./pagination.module.css";

export type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  /** Com isto aparece o "Por página" com o seletor de quantas linhas. */
  onPageSizeChange?: (pageSize: number) => void;
  label?: string;
  className?: string;
  style?: CSSProperties;
};

export const defaultPageSizeOptions = [10, 20, 30, 50, 100];

/** As páginas que cabem na fila: a primeira, a última e as vizinhas da atual, com reticências onde pulou. */
function pagesToShow(page: number, count: number): (number | "gap-start" | "gap-end")[] {
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1);
  const near = new Set([1, count, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((value) => near.add(value));
  if (page >= count - 2) [count - 3, count - 2, count - 1].forEach((value) => near.add(value));
  const sorted = [...near].filter((value) => value >= 1 && value <= count).toSorted((a, b) => a - b);
  const result: (number | "gap-start" | "gap-end")[] = [];
  sorted.forEach((value, index) => {
    const before = sorted[index - 1];
    if (before !== undefined && value - before > 1) result.push(before < page ? "gap-start" : "gap-end");
    result.push(value);
  });
  return result;
}

/**
 * O controle de páginas do pé de toda lista, no desenho da pousada (2026-10-26, a pedido: "padronize a tabela de
 * todo o sistema"): quantas linhas por página, qual faixa está à vista ("1–50 de 644") e as páginas, com as
 * vizinhas da atual e reticências onde pula. Quem manda na página é quem chama (a URL, nas listas que paginam no
 * servidor, ou `useListPagination`, nas que cortam no navegador); aqui só se desenha e se avisa.
 */
export function Pagination({ page, pageSize, total, pageSizeOptions = defaultPageSizeOptions, onPageChange, onPageSizeChange, label = "Paginação", className, style }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(total, current * pageSize);

  return (
    <nav className={className ? `${styles.pagination} ${className}` : styles.pagination} style={style} aria-label={label}>
      {onPageSizeChange && (
        <div className={styles.size}>
          <span>Por página</span>
          <div className={styles.select}>
            <Select
              label="Linhas por página"
              size="sm"
              value={String(pageSize)}
              options={pageSizeOptions.map((value) => ({ value: String(value), label: String(value) }))}
              onChange={(value) => onPageSizeChange(Number(value))}
            />
          </div>
        </div>
      )}

      <span className={styles.range} aria-live="polite">
        {total === 0 ? "Nenhum item" : `${from}–${to} de ${total}`}
      </span>

      <div className={styles.pages}>
        <IconButton label="Página anterior" variant="secondary" size="sm" radius="full" className={styles.step} disabled={current <= 1} onClick={() => onPageChange(current - 1)}>
          <CaretLeftIcon />
        </IconButton>
        <ol className={styles.numbers}>
          {pagesToShow(current, pageCount).map((entry) =>
            typeof entry === "number" ? (
              <li key={entry}>
                <button type="button" className={styles.number} aria-label={`Página ${entry}`} aria-current={entry === current ? "page" : undefined} onClick={() => onPageChange(entry)}>
                  {entry}
                </button>
              </li>
            ) : (
              <li key={entry} className={styles.gap} aria-hidden="true">
                …
              </li>
            ),
          )}
        </ol>
        <IconButton label="Próxima página" variant="secondary" size="sm" radius="full" className={styles.step} disabled={current >= pageCount} onClick={() => onPageChange(current + 1)}>
          <CaretRightIcon />
        </IconButton>
      </div>
    </nav>
  );
}
