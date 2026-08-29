"use client";

import styled from "@emotion/styled";
import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";

export type SwitchSize = "sm" | "md";

export type SwitchProps = Omit<ComponentPropsWithoutRef<"input">, "type" | "size" | "children" | "role"> & {
  size?: SwitchSize;
  children?: ReactNode;
  ref?: Ref<HTMLInputElement>;
};

const Root = styled.label`
  --switch-height: 1.75rem;
  --switch-width: 4rem;
  --switch-thumb-width: 2.25rem;
  --switch-inset: var(--space-half);
  --switch-track: var(--color-fill);
  --switch-thumb: var(--color-on-accent);
  --switch-offset: 0px;
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-subheadline);
  line-height: var(--leading-normal);
  letter-spacing: var(--tracking-tight);
  color: var(--color-label);
  cursor: pointer;

  &[data-size="sm"] {
    --switch-height: 1.25rem;
    --switch-width: 2.75rem;
    --switch-thumb-width: 1.5rem;
    gap: var(--space-2);
  }

  &:hover {
    --switch-track: var(--color-fill-secondary);
  }

  &:has(input:checked) {
    --switch-track: var(--color-success);
    --switch-offset: calc(var(--switch-width) - var(--switch-thumb-width) - var(--switch-inset) * 2);
  }

  &:has(input:checked):hover {
    --switch-track: color-mix(in oklab, var(--color-success) 90%, var(--color-label));
  }

  &:has(input:focus-visible) [data-track] {
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

const Track = styled.span`
  display: block;
  flex-shrink: 0;
  box-sizing: border-box;
  width: var(--switch-width);
  height: var(--switch-height);
  padding: var(--switch-inset);
  background-color: var(--switch-track);
  border-radius: var(--radius-full);
  transition: background-color var(--duration-base) var(--ease-standard);
`;

const Thumb = styled.span`
  display: block;
  width: var(--switch-thumb-width);
  height: 100%;
  background-color: var(--switch-thumb);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-sm);
  translate: var(--switch-offset) 0;
  transition: translate var(--duration-base) var(--ease-standard);

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export function Switch({ size = "md", children, className, style, ...props }: SwitchProps) {
  return (
    <Root as={children ? "label" : "span"} data-size={size} className={className} style={style}>
      <Input type="checkbox" role="switch" {...props} />
      <Track data-track aria-hidden="true">
        <Thumb />
      </Track>
      {children && <span>{children}</span>}
    </Root>
  );
}
