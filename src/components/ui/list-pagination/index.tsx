"use client";

import type { ReactNode } from "react";
import { useFloatingPagerRegistration } from "@/components/layout/floating-actions";
import type { ListPagination as ListPaginationState } from "@/hooks/use-list-pagination";
import { Pagination } from "../pagination";
import styles from "./list-pagination.module.css";

export type ListPaginationProps<T> = {
  state: ListPaginationState<T>;
  /** O que a lista é, no plural: "oportunidades", "clientes". */
  noun: string;
};

/**
 * As páginas de uma lista cortada no navegador (`useListPagination`), trazidas do sistema da pousada
 * (2026-10-26): o desenho é a `Pagination` da casa, e aqui fica o que é da lista. No celular as páginas passam
 * para a barra flutuante. Aparece sempre, mesmo com uma página só: a faixa "1–22 de 22" diz quanto há, e o
 * tamanho fica à mão. Some só com a lista vazia.
 */
export function ListPagination<T>({ state, noun }: ListPaginationProps<T>) {
  const { page, pageCount, pageSize, sizes, total, setPage, setPageSize } = state;

  // No celular as páginas moram na barra flutuante (anterior, 2/9, próxima), no lugar da busca e do sino: o pé da lista some.
  useFloatingPagerRegistration(pageCount > 1 ? { page, pageCount, label: `Páginas de ${noun}`, onPageChange: setPage } : null);

  if (total === 0) return null;

  return (
    <Pagination
      page={page}
      pageSize={pageSize}
      total={total}
      pageSizeOptions={[...sizes]}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      label={`Páginas de ${noun}`}
    />
  );
}

/** A lista com as páginas flutuando numa pílula no pé, por cima das linhas, como na pousada. */
export function PagedBody({ pager, className, children }: { pager: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={className ? `${styles.paged} ${className}` : styles.paged} data-pager={pager ? "" : undefined}>
      {children}
      {pager && <div className={styles.pager}>{pager}</div>}
    </div>
  );
}
