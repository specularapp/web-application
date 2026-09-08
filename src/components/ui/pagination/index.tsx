"use client";

import styled from "@emotion/styled";
import { CaretDoubleLeftIcon, CaretDoubleRightIcon, CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { MOBILE_QUERY } from "@/hooks/use-media-query";
import { IconButton } from "../icon-button";
import { Listbox, type ListboxOption } from "../listbox";
import { Separator } from "../separator";
import { VisuallyHidden } from "../visually-hidden";

export type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  label?: string;
  className?: string;
  style?: CSSProperties;
};

export const defaultPageSizeOptions = [10, 20, 30, 50, 100];

const numberFormat = new Intl.NumberFormat("pt-BR");

/* Uma caixa só, com o fio da casa, e as peças separadas por fios dentro dela: primeira, anterior, a
   página em vigor (que é uma lista para pular direto), próxima e última. Os menus de dentro se vestem
   como o resto da caixa: sem fundo nem fio próprios, na altura do controle pequeno. */
const Bar = styled.nav`
  --listbox-trigger-height: var(--control-height-sm);
  --listbox-trigger-radius: var(--radius-sm);
  --listbox-trigger-background: transparent;
  --listbox-trigger-background-hover: var(--color-fill-quaternary);
  --listbox-trigger-font-size: var(--text-footnote);
  --listbox-trigger-weight: var(--weight-medium);
  --listbox-trigger-padding: var(--space-3);

  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  max-width: 100%;
  height: calc(var(--control-height-sm) + 2 * var(--space-half));
  padding: var(--space-half);
  background-color: var(--color-bg);
  border: 0.0375rem solid var(--color-border);
  border-radius: var(--radius-md);
  corner-shape: squircle;

  & > * {
    flex-shrink: 0;
  }

  /* Os fios de dentro ficam mais baixos que a caixa e no fio fino da casa, para dividir sem desenhar
     cela: o Separator puro traz o separador cheio, quase três vezes mais opaco, que aqui vira grade. */
  & > [data-divider] {
    align-self: center;
    height: calc(var(--control-height-sm) - var(--space-3));
    min-height: 0;
    margin-inline: var(--space-half);
    background-color: var(--color-border);
  }

  @media ${MOBILE_QUERY} {
    & > [data-desktop] {
      display: none;
    }
  }
`;

export function Pagination({
  page,
  pageSize,
  total,
  pageSizeOptions = defaultPageSizeOptions,
  onPageChange,
  onPageSizeChange,
  label = "Paginação",
  className,
  style,
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const first = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const last = Math.min(total, current * pageSize);
  const sizes: ListboxOption<number>[] = pageSizeOptions.map((size) => ({ value: size, label: String(size) }));
  // A página em vigor lê "1/12" e abre a lista de todas, para pular direto sem apertar a seta doze vezes.
  const pages: ListboxOption<number>[] = Array.from({ length: pageCount }, (_, index) => ({
    value: index + 1,
    label: `${numberFormat.format(index + 1)}/${numberFormat.format(pageCount)}`,
  }));

  return (
    <Bar aria-label={label} className={className} style={style}>
      {onPageSizeChange && (
        <>
          <span data-desktop>
            <Listbox label="Itens por página" prefix="Mostrar" placement="above" options={sizes} value={pageSize} onChange={onPageSizeChange} />
          </span>
          <Separator orientation="vertical" data-divider data-desktop />
        </>
      )}
      <IconButton label="Primeira página" variant="ghost" size="sm" radius="md" disabled={current <= 1} onClick={() => onPageChange(1)}>
        <CaretDoubleLeftIcon />
      </IconButton>
      <Separator orientation="vertical" data-divider />
      <IconButton label="Página anterior" variant="ghost" size="sm" radius="md" disabled={current <= 1} onClick={() => onPageChange(current - 1)}>
        <CaretLeftIcon />
      </IconButton>
      <Separator orientation="vertical" data-divider />
      <Listbox label="Ir para a página" placement="above" options={pages} value={current} onChange={onPageChange} />
      <VisuallyHidden aria-live="polite">
        {total === 0 ? "Nenhum item" : `Página ${current} de ${pageCount}, itens ${first} a ${last} de ${total}`}
      </VisuallyHidden>
      <Separator orientation="vertical" data-divider />
      <IconButton label="Próxima página" variant="ghost" size="sm" radius="md" disabled={current >= pageCount} onClick={() => onPageChange(current + 1)}>
        <CaretRightIcon />
      </IconButton>
      <Separator orientation="vertical" data-divider />
      <IconButton label="Última página" variant="ghost" size="sm" radius="md" disabled={current >= pageCount} onClick={() => onPageChange(pageCount)}>
        <CaretDoubleRightIcon />
      </IconButton>
    </Bar>
  );
}
