"use client";

import styled from "@emotion/styled";
import { useState, type ReactNode } from "react";
import { Listbox, type ListboxOption, type ListboxValue } from "../listbox";
import type { ControlSize } from "../styles";

export type SelectOption<T extends ListboxValue> = ListboxOption<T>;

export type SelectProps<T extends ListboxValue> = {
  label: string;
  options: SelectOption<T>[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  name?: string;
  id?: string;
  placeholder?: string;
  size?: ControlSize;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  className?: string;
  iconEnd?: ReactNode;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

// Mesmas medidas do FieldShell, para o select e o campo de texto lerem como a mesma família:
// altura e recuo do controle, raio do tamanho e piso de 16px na fonte, que evita o zoom do iOS.
const Shell = styled.span`
  position: relative;
  display: flex;
  width: 100%;
  min-width: 0;
  --listbox-trigger-background: transparent;
  --listbox-trigger-background-hover: var(--color-fill-quaternary);
  --listbox-trigger-border: var(--color-border);
  --listbox-trigger-weight: var(--weight-regular);
  --listbox-caret-size: 1rem;

  &[data-size="sm"] {
    --listbox-trigger-height: var(--control-height-sm);
    --listbox-trigger-radius: var(--control-radius-sm);
    --listbox-trigger-padding: var(--control-padding-sm);
    --listbox-trigger-font-size: max(16px, var(--text-footnote));
  }

  &[data-size="md"] {
    --listbox-trigger-height: var(--control-height-md);
    --listbox-trigger-radius: var(--control-radius-md);
    --listbox-trigger-padding: var(--control-padding-md);
    --listbox-trigger-font-size: max(16px, var(--text-subheadline));
  }

  &[data-size="lg"] {
    --listbox-trigger-height: var(--control-height-lg);
    --listbox-trigger-radius: var(--control-radius-lg);
    --listbox-trigger-padding: var(--control-padding-lg);
    --listbox-trigger-font-size: max(16px, var(--text-body));
  }

  @media (pointer: coarse) {
    --listbox-trigger-height: max(var(--control-height-md), var(--touch-target));
  }
`;

const Adornment = styled.span`
  position: absolute;
  inset-block: 0;
  inset-inline-end: calc(var(--control-padding-md) + var(--space-5));
  display: inline-flex;
  align-items: center;
  color: var(--color-label);
`;

export function Select<T extends ListboxValue>({
  label,
  options,
  value,
  defaultValue,
  onChange,
  name,
  id,
  placeholder = "Selecione",
  size = "md",
  disabled = false,
  required = false,
  invalid = false,
  className,
  iconEnd,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
}: SelectProps<T>) {
  const [internal, setInternal] = useState<T | undefined>(defaultValue);
  const current = value ?? internal;
  const flagged = invalid || ariaInvalid === true;

  return (
    <Shell className={className} data-size={size}>
      <Listbox
        label={label}
        options={options}
        value={current as T}
        onChange={(next) => {
          setInternal(next);
          onChange?.(next);
        }}
        id={id}
        fullWidth
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        invalid={flagged}
        describedBy={describedBy}
      />
      {iconEnd && <Adornment>{iconEnd}</Adornment>}
      {name && <input type="hidden" name={name} value={current === undefined ? "" : String(current)} />}
    </Shell>
  );
}
