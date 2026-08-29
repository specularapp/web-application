"use client";

import styled from "@emotion/styled";
import type { ComponentPropsWithoutRef, Ref } from "react";
import { controlCornerRadius, squirclePx } from "@/lib/corners";
import { fieldMetrics, type ControlSize } from "../styles";

const fieldBorder = { color: "var(--color-border)" };

const Surface = styled.span`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-width: 0;
  color: var(--color-label);
  background-color: var(--color-bg-grouped-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--field-radius);
  --ck-background: var(--color-bg-grouped-secondary);
  --ck-border-color: var(--color-border);

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
    --ck-border-color: var(--color-danger);
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
`;

export type FieldShellProps = ComponentPropsWithoutRef<"span"> & {
  size?: ControlSize;
  invalid?: boolean;
  ref?: Ref<HTMLSpanElement>;
};

export function FieldShell({ size = "md", invalid = false, ...props }: FieldShellProps) {
  return (
    <Surface
      data-size={size}
      data-invalid={invalid || undefined}
      {...squirclePx(controlCornerRadius[size], fieldBorder)}
      {...props}
    />
  );
}
