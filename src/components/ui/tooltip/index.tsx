"use client";

import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";
import { cloneElement, useId, useState, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import { squircle } from "@/lib/corners";

type TriggerProps = { "aria-describedby"?: string };

export type TooltipProps = {
  content: ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "end" | "center";
  open?: boolean;
  className?: string;
  children: ReactElement<TriggerProps>;
};

const enter = keyframes`
  from {
    opacity: 0;
    transform: translateY(var(--slide)) scale(0.95);
  }
`;

const Root = styled.span`
  --arrow-size: 0.625rem;
  --arrow-inset: calc(var(--radius-sm) + var(--arrow-size) / 2);
  --offset: calc(var(--space-2) + var(--space-half));
  position: relative;
  display: inline-flex;
  align-items: center;
`;

const Bubble = styled.span`
  position: absolute;
  z-index: var(--z-overlay);
  width: max-content;
  max-width: 20rem;
  padding: calc(var(--space-1) + var(--space-half)) var(--space-3);
  font-family: var(--font-body);
  font-size: var(--text-caption-1);
  font-weight: var(--weight-regular);
  line-height: var(--leading-normal);
  letter-spacing: var(--tracking-tight);
  color: var(--color-bg);
  text-align: start;
  text-wrap: balance;
  background-color: var(--color-label);
  border: 1px solid var(--color-label);
  border-radius: var(--radius-sm);
  pointer-events: none;
  transform-origin: var(--origin-x) var(--origin-y);
  animation: ${enter} var(--duration-fast) var(--ease-standard);
  --ck-background: var(--color-label);
  --ck-border-color: var(--color-label);

  &[data-side="top"] {
    bottom: calc(100% + var(--offset));
    --slide: var(--space-2);
    --origin-y: 100%;
  }

  &[data-side="bottom"] {
    top: calc(100% + var(--offset));
    --slide: calc(var(--space-2) * -1);
    --origin-y: 0;
  }

  &[data-align="start"] {
    inset-inline-start: calc(50% - var(--arrow-inset));
    --origin-x: var(--arrow-inset);
  }

  &[data-align="end"] {
    inset-inline-end: calc(50% - var(--arrow-inset));
    --origin-x: calc(100% - var(--arrow-inset));
  }

  &[data-align="center"] {
    inset-inline-start: 50%;
    translate: -50%;
    --origin-x: 50%;
  }
`;

const Arrow = styled.span`
  position: absolute;
  width: var(--arrow-size);
  height: var(--arrow-size);
  background-color: var(--color-label);
  border-radius: calc(var(--radius-xs) / 2);
  rotate: 45deg;

  [data-side="top"] > & {
    bottom: calc(var(--arrow-size) / -2 + var(--space-half));
  }

  [data-side="bottom"] > & {
    top: calc(var(--arrow-size) / -2 + var(--space-half));
  }

  [data-align="start"] > & {
    inset-inline-start: var(--radius-sm);
  }

  [data-align="end"] > & {
    inset-inline-end: var(--radius-sm);
  }

  [data-align="center"] > & {
    inset-inline-start: 50%;
    translate: -50%;
  }
`;

export function Tooltip({ content, side = "top", align = "center", open, className, children }: TooltipProps) {
  const [hovered, setHovered] = useState(false);
  const bubbleId = useId();
  const visible = open ?? hovered;

  const close = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === "Escape") setHovered(false);
  };

  return (
    <Root
      className={className}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={() => setHovered(false)}
      onKeyDown={close}
    >
      {cloneElement(children, { "aria-describedby": visible ? bubbleId : undefined })}
      {visible && (
        <Bubble
          id={bubbleId}
          role="tooltip"
          data-side={side}
          data-align={align}
          {...squircle("sm", { color: "var(--color-label)" })}
        >
          {content}
          <Arrow aria-hidden="true" />
        </Bubble>
      )}
    </Root>
  );
}
