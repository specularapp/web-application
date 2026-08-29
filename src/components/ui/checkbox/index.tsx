"use client";

import styled from "@emotion/styled";
import { CheckIcon, MinusIcon } from "@phosphor-icons/react";
import { useEffect, useRef, type ComponentPropsWithoutRef, type ReactNode, type Ref } from "react";

export type CheckboxProps = Omit<ComponentPropsWithoutRef<"input">, "type" | "size" | "children"> & {
  indeterminate?: boolean;
  children?: ReactNode;
  ref?: Ref<HTMLInputElement>;
};

const Root = styled.label`
  --checkbox-size: 1.25rem;
  --checkbox-background: var(--color-bg-grouped-secondary);
  --checkbox-border: var(--color-label-tertiary);
  --checkbox-mark: var(--color-bg);
  --checkbox-check: none;
  --checkbox-minus: none;
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-subheadline);
  line-height: var(--leading-normal);
  letter-spacing: var(--tracking-tight);
  color: var(--color-label);
  cursor: pointer;

  &:hover {
    --checkbox-border: var(--color-label-secondary);
  }

  &:has(input:checked),
  &:has(input:indeterminate) {
    --checkbox-background: var(--color-brand);
    --checkbox-border: var(--color-brand);
  }

  &:has(input:checked) {
    --checkbox-check: block;
  }

  &:has(input:indeterminate) {
    --checkbox-check: none;
    --checkbox-minus: block;
  }

  &:has(input:focus-visible) [data-box] {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  &:has(input:disabled) {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const Input = styled.input`
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: inherit;
`;

const Box = styled.span`
  display: grid;
  flex-shrink: 0;
  place-items: center;
  box-sizing: border-box;
  width: var(--checkbox-size);
  height: var(--checkbox-size);
  color: var(--checkbox-mark);
  background-color: var(--checkbox-background);
  border: 1.5px solid var(--checkbox-border);
  border-radius: var(--radius-sm);
  corner-shape: squircle;
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard);

  & svg {
    grid-area: 1 / 1;
    width: 0.875rem;
    height: 0.875rem;
    fill: currentColor;
  }

  & [data-check] {
    display: var(--checkbox-check);
  }

  & [data-minus] {
    display: var(--checkbox-minus);
  }
`;

export function Checkbox({ indeterminate = false, children, className, style, ref, ...props }: CheckboxProps) {
  const inner = useRef<HTMLInputElement>(null);

  const setRef = (node: HTMLInputElement | null) => {
    inner.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  useEffect(() => {
    if (inner.current) inner.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <Root as={children ? "label" : "span"} className={className} style={style}>
      <Input ref={setRef} type="checkbox" {...props} />
      <Box data-box aria-hidden="true">
        <CheckIcon data-check weight="bold" />
        <MinusIcon data-minus weight="bold" />
      </Box>
      {children && <span>{children}</span>}
    </Root>
  );
}
