"use client";

import styled from "@emotion/styled";
import type { ReactNode } from "react";
import { useTabList } from "@/hooks/use-tab-list";

export type SegmentedOption<T extends string> = { value: T; label: string; icon?: ReactNode; count?: number };

const Group = styled.div`
  display: inline-flex;
  flex-shrink: 0;
  gap: var(--space-half);
  max-width: 100%;
  padding: var(--space-half);
  overflow-x: auto;
  background-color: var(--color-fill-quaternary);
  border-radius: var(--radius-md);
`;

const Item = styled.button`
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
  min-height: 1.75rem;
  padding-inline: var(--space-2);
  font-family: var(--font-body);
  font-size: var(--text-footnote);
  font-weight: var(--weight-medium);
  color: var(--color-label-secondary);
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);

  & svg {
    width: 0.9375rem;
    height: 0.9375rem;
  }

  &:hover {
    color: var(--color-label);
  }

  &[aria-selected="true"],
  &[aria-checked="true"] {
    color: var(--color-label);
    background-color: var(--color-bg);
    box-shadow: var(--shadow-sm);
  }

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  @media (pointer: coarse) {
    min-height: var(--touch-target);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const Count = styled.span`
  min-width: 1.25rem;
  padding: 0 var(--space-1);
  font-size: var(--text-caption-1);
  font-variant-numeric: tabular-nums;
  color: var(--color-label-secondary);
  text-align: center;
  background-color: var(--color-fill-tertiary);
  border-radius: var(--radius-full);
`;

/**
 * A fila de escolhas em segmento, no desenho do filtro das movimentações do financeiro: abas quando troca o
 * que a tela mostra (`tab`), rádio quando troca o jeito de ver o mesmo dado (`radio`). O teclado é o da casa.
 */
export function Segmented<T extends string>({ label, value, options, onChange, as = "tab", controls }: { label: string; value: T; options: SegmentedOption<T>[]; onChange: (value: T) => void; as?: "tab" | "radio"; controls?: string }) {
  const values = options.map((option) => option.value);
  const tabs = useTabList(values, value, onChange, { as });
  return (
    <Group aria-label={label} {...tabs.listProps}>
      {options.map((option) => (
        <Item key={option.value} type="button" {...tabs.tabProps(option.value)} aria-controls={as === "tab" ? controls : undefined} onClick={() => onChange(option.value)}>
          {option.icon}
          {option.label}
          {option.count !== undefined && <Count>{option.count}</Count>}
        </Item>
      ))}
    </Group>
  );
}
