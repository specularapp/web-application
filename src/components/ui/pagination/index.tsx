"use client";

import styled from "@emotion/styled";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { MOBILE_QUERY } from "@/hooks/use-media-query";
import { IconButton } from "../icon-button";
import { Listbox, type ListboxOption } from "../listbox";
import { Separator } from "../separator";
import { Text } from "../text";
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

const Bar = styled.nav`
  --listbox-trigger-height: var(--control-height-sm);
  --listbox-trigger-radius: var(--icon-button-radius-sm);
  --listbox-trigger-background: var(--color-bg-tertiary);
  --listbox-trigger-background-hover: color-mix(in oklab, var(--color-bg-tertiary) 94%, var(--color-label));
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: var(--space-2);
  max-width: 100%;
  padding: var(--space-1);
  background-color: var(--color-fill-quaternary);
  border-radius: var(--icon-button-radius-md);
  corner-shape: squircle;
  box-shadow: inset 0 0 0 1px var(--color-border);

  & > * {
    flex-shrink: 0;
  }

  & [data-listbox] {
    box-shadow:
      0 0 0 1px var(--color-border),
      var(--shadow-sm);
    border-radius: var(--icon-button-radius-sm);
    corner-shape: squircle;
  }

  @media ${MOBILE_QUERY} {
    & > [data-desktop] {
      display: none;
    }
  }
`;

const Range = styled(Text)`
  flex: 1 1 auto;
  min-width: 12rem;
  padding-inline: var(--space-2) var(--space-4);
`;

const Group = styled.div`
  display: inline-flex;
  align-items: center;
  height: var(--control-height-sm);
  margin-inline-start: auto;
  background-color: var(--color-bg-tertiary);
  border-radius: var(--icon-button-radius-sm);
  corner-shape: squircle;
  box-shadow:
    0 0 0 1px var(--color-border),
    var(--shadow-sm);
`;

const Indicator = styled.p`
  display: inline-flex;
  justify-content: center;
  gap: var(--space-1);
  width: 5.5rem;
  margin: 0;
  padding-inline: var(--space-2);
  font-size: var(--text-subheadline);
  font-variant-numeric: tabular-nums;
  letter-spacing: var(--tracking-tight);
  white-space: nowrap;
  color: var(--color-label-secondary);

  & b {
    font-weight: var(--weight-semibold);
    color: var(--color-label);
  }
`;

function rangeText(first: number, last: number, total: number) {
  if (total === 0) return "Nenhum item";
  return `Itens ${numberFormat.format(first)} a ${numberFormat.format(last)} de ${numberFormat.format(total)}`;
}

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

  return (
    <Bar aria-label={label} className={className} style={style}>
      {onPageSizeChange && (
        <span data-listbox data-desktop>
          <Listbox
            label="Itens por página"
            prefix="Mostrar"
            placement="above"
            options={sizes}
            value={pageSize}
            onChange={onPageSizeChange}
          />
        </span>
      )}
      <Range as="p" variant="subheadline" tone="secondary" numeric truncate data-desktop>
        {rangeText(first, last, total)}
      </Range>
      <Group>
        <Indicator aria-live="polite">
          <span aria-hidden="true">
            <b>{numberFormat.format(current)}</b> / {numberFormat.format(pageCount)}
          </span>
          <VisuallyHidden>{`Página ${current} de ${pageCount}`}</VisuallyHidden>
        </Indicator>
        <Separator orientation="vertical" />
        <IconButton
          label="Página anterior"
          variant="ghost"
          size="sm"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
        >
          <CaretLeftIcon />
        </IconButton>
        <Separator orientation="vertical" />
        <IconButton
          label="Próxima página"
          variant="ghost"
          size="sm"
          disabled={current >= pageCount}
          onClick={() => onPageChange(current + 1)}
        >
          <CaretRightIcon />
        </IconButton>
      </Group>
    </Bar>
  );
}
