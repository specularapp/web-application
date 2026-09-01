"use client";

import styled from "@emotion/styled";
import type { ComponentPropsWithoutRef, Ref } from "react";
import { fieldMetrics, type ControlSize } from "../styles";

const Surface = styled.span`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-width: 0;
  color: var(--color-label);
  background-color: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--field-radius);
  corner-shape: squircle;

  &[data-size="sm"] {
    ${fieldMetrics("sm")};
    --field-radius: var(--control-radius-sm);
  }

  &[data-size="md"] {
    ${fieldMetrics("md")};
    --field-radius: var(--control-radius-md);
  }

  &[data-size="lg"] {
    ${fieldMetrics("lg")};
    --field-radius: var(--control-radius-lg);
  }

  &[data-invalid] {
    border-color: var(--color-danger);
  }

  &:has(:disabled) {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

export const FieldAdornment = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  color: inherit;
`;

export const FieldAffix = styled.span`
  flex-shrink: 0;
  font-weight: var(--weight-semibold);
  letter-spacing: var(--tracking-tight);
  color: inherit;
  user-select: none;

  /* Unidade (R$, %) pesa igual ao valor e fica solta do número; prefixo de endereço é contexto, não
     compete com o que foi digitado e encosta no texto, porque as duas partes formam um endereço só.
     O recuo negativo come o gap do FieldShell, que separa o afixo do controle. */
  &[data-tone="muted"] {
    margin-inline-end: calc(var(--space-half) - var(--space-2));
    font-weight: var(--weight-regular);
    color: var(--color-label-tertiary);
  }
`;

export type FieldShellProps = ComponentPropsWithoutRef<"span"> & {
  size?: ControlSize;
  invalid?: boolean;
  ref?: Ref<HTMLSpanElement>;
};

export function FieldShell({ size = "md", invalid = false, ...props }: FieldShellProps) {
  return <Surface data-size={size} data-invalid={invalid || undefined} {...props} />;
}
