"use client";

import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";
import { InfoIcon, SealCheckIcon, WarningCircleIcon, WarningIcon, type Icon } from "@phosphor-icons/react";
import { useId, type ComponentPropsWithoutRef, type KeyboardEvent } from "react";
import { Button } from "../button";
import { Text } from "../text";

export type ToastTone = "neutral" | "info" | "success" | "warning" | "danger";

export type ToastAction = { label: string; onClick?: () => void };

export type ToastProps = Omit<ComponentPropsWithoutRef<"div">, "title" | "role"> & {
  title: string;
  description: string;
  tone?: ToastTone;
  action?: ToastAction;
  state?: "open" | "closed";
  onDismiss: () => void;
};

export const defaultToastAction: ToastAction = { label: "Entendi" };

const toneIcon: Record<ToastTone, Icon> = {
  neutral: InfoIcon,
  info: InfoIcon,
  success: SealCheckIcon,
  warning: WarningCircleIcon,
  danger: WarningIcon,
};

const enter = keyframes`
  from {
    opacity: 0;
    transform: translateY(calc(var(--space-4) * -1)) scale(0.96);
  }
`;

const leave = keyframes`
  to {
    opacity: 0;
    transform: translateY(calc(var(--space-2) * -1)) scale(0.96);
  }
`;

const Root = styled.div`
  --toast-tone: var(--color-label-secondary);
  --toast-radius: var(--radius-xl);
  --toast-pad: var(--space-3);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--toast-pad) var(--toast-pad) var(--toast-pad) var(--space-4);
  color: var(--color-label);
  background-color: var(--color-bg-grouped-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--toast-radius);
  corner-shape: squircle;
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
  animation: ${enter} var(--duration-slow) var(--ease-spring) both;

  &[data-state="closed"] {
    animation: ${leave} var(--duration-base) var(--ease-standard) forwards;
    pointer-events: none;
  }

  &[data-tone="info"] { --toast-tone: var(--color-info); }
  &[data-tone="success"] { --toast-tone: var(--color-success); }
  &[data-tone="warning"] { --toast-tone: var(--color-warning); }
  &[data-tone="danger"] { --toast-tone: var(--color-danger); }

  @media (prefers-reduced-motion: reduce) {
    animation: none;

    &[data-state="closed"] {
      animation: none;
      opacity: 0;
    }
  }
`;

const Glyph = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  color: var(--toast-tone);
  line-height: 0;

  & svg {
    width: 1.5rem;
    height: 1.5rem;
    fill: currentColor;
  }
`;

const Body = styled.div`
  display: grid;
  gap: var(--space-half);
  min-width: 0;
`;

const Description = styled.p`
  margin: 0;
  font-size: var(--text-footnote);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-tight);
  color: var(--color-label-secondary);
`;

export function Toast({
  title,
  description,
  tone = "neutral",
  action = defaultToastAction,
  state = "open",
  onDismiss,
  onKeyDown,
  ...props
}: ToastProps) {
  const id = useId();
  const Glyphicon = toneIcon[tone];
  const alert = tone === "danger" || tone === "warning";

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.key === "Escape") {
      event.stopPropagation();
      onDismiss();
    }
  };

  return (
    <Root
      role={alert ? "alert" : "status"}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      data-tone={tone}
      data-state={state}
      onKeyDown={handleKeyDown}
      {...props}
    >
      <Glyph aria-hidden="true">
        <Glyphicon weight="fill" />
      </Glyph>
      <Body>
        <Text id={`${id}-title`} as="p" variant="subheadline" weight="semibold" truncate>
          {title}
        </Text>
        <Description id={`${id}-description`}>{description}</Description>
      </Body>
      <Button
        size="sm"
        radius="md"
        variant={tone === "danger" ? "primary" : "secondary"}
        onClick={() => {
          action.onClick?.();
          onDismiss();
        }}
      >
        {action.label}
      </Button>
    </Root>
  );
}
