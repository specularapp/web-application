"use client";

import styled from "@emotion/styled";
import { LockIcon } from "@phosphor-icons/react";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode, Ref } from "react";
import {
  concentric,
  cornerRadius,
  controlCornerRadius,
  iconButtonCornerRadius,
  squircle,
  squirclePx,
} from "@/lib/corners";
import { matchIconWeight } from "../icons";
import { Spinner } from "../spinner";
import {
  controlGlyph,
  controlMetrics,
  controlSquare,
  disabledState,
  focusRing,
  hoverMotion,
  type ControlSize,
} from "../styles";
import { VisuallyHidden } from "../visually-hidden";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

export type ButtonRadius = "auto" | "md" | "lg" | "xl" | "full";

export type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
  size?: ControlSize;
  radius?: ButtonRadius;
  fullWidth?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  iconOnly?: boolean;
  loading?: boolean;
  locked?: boolean;
  href?: string;
  plan?: string;
  background?: string;
  foreground?: string;
  border?: string;
  ref?: Ref<HTMLButtonElement>;
};

const iconWeight = "bold";

function matchTextWeight(node: ReactNode) {
  return matchIconWeight(node, iconWeight);
}

function autoCorner(size: ControlSize, iconOnly: boolean) {
  return iconOnly ? iconButtonCornerRadius[size] : controlCornerRadius[size];
}

function planCorner(radius: ButtonRadius, size: ControlSize) {
  const outer = radius === "auto" || radius === "full" ? controlCornerRadius[size] : cornerRadius[radius];
  return concentric(outer, 2);
}

function cornerAttributes(radius: ButtonRadius, size: ControlSize, iconOnly: boolean) {
  if (radius === "full") return {};
  if (radius !== "auto") return squircle(radius);
  return squirclePx(autoCorner(size, iconOnly));
}

const Root = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  max-width: 100%;
  padding-block: var(--space-2);
  font-family: var(--font-body);
  font-weight: var(--weight-semibold);
  line-height: var(--leading-normal);
  letter-spacing: var(--tracking-tighter);
  text-align: center;
  color: var(--button-foreground);
  background-color: var(--button-background);
  border: 1px solid var(--button-border);
  border-radius: var(--button-radius);

  ${hoverMotion};
  ${focusRing};
  ${disabledState};

  &[data-loading]:disabled {
    opacity: 0.75;
    cursor: progress;
  }

  & [data-button-icon] {
    display: inline-flex;
    flex-shrink: 0;
    line-height: 0;
    color: inherit;
  }

  & [data-button-icon] [role="status"] {
    --diameter: 1.2em;
    color: currentColor;
  }

  & [data-button-icon] svg {
    width: 1.2em;
    height: 1.2em;
    fill: currentColor;
  }

  &[data-icon-only][data-size="sm"] [data-button-icon] svg {
    ${controlGlyph("sm")};
  }

  &[data-icon-only][data-size="md"] [data-button-icon] svg {
    ${controlGlyph("md")};
  }

  &[data-icon-only][data-size="lg"] [data-button-icon] svg {
    ${controlGlyph("lg")};
  }

  &[data-radius="auto"][data-size="sm"] {
    --button-radius: var(--control-radius-sm);
  }

  &[data-radius="auto"][data-size="md"] {
    --button-radius: var(--control-radius-md);
  }

  &[data-radius="auto"][data-size="lg"] {
    --button-radius: var(--control-radius-lg);
  }

  &[data-radius="auto"][data-icon-only][data-size="sm"] {
    --button-radius: var(--icon-button-radius-sm);
  }

  &[data-radius="auto"][data-icon-only][data-size="md"] {
    --button-radius: var(--icon-button-radius-md);
  }

  &[data-radius="auto"][data-icon-only][data-size="lg"] {
    --button-radius: var(--icon-button-radius-lg);
  }

  &[data-radius="md"] {
    --button-radius: var(--radius-md);
  }

  &[data-radius="lg"] {
    --button-radius: var(--radius-lg);
  }

  &[data-radius="xl"] {
    --button-radius: var(--radius-xl);
  }

  &[data-radius="full"] {
    --button-radius: var(--radius-full);
  }

  &[data-size="sm"] {
    ${controlMetrics("sm")};
    gap: var(--space-2);
    padding-inline: var(--space-4);
  }

  &[data-size="md"] {
    ${controlMetrics("md")};
    gap: var(--space-2);
    padding-inline: var(--space-5);
  }

  &[data-size="lg"] {
    ${controlMetrics("lg")};
    gap: var(--space-3);
    padding-inline: var(--space-6);
  }

  &[data-icon-only][data-size="sm"] {
    ${controlSquare("sm")};
  }

  &[data-icon-only][data-size="md"] {
    ${controlSquare("md")};
  }

  &[data-icon-only][data-size="lg"] {
    ${controlSquare("lg")};
  }

  &:hover:not(:disabled) {
    background-color: var(--button-background-hover);
  }

  &[data-variant="primary"] {
    --button-background: var(--color-brand);
    --button-background-hover: color-mix(in oklab, var(--color-brand) 88%, var(--color-bg));
    --button-foreground: var(--color-bg);
    --button-border: transparent;
  }

  &[data-variant="secondary"] {
    --button-background: var(--color-fill-quaternary);
    --button-background-hover: var(--color-fill-tertiary);
    --button-foreground: var(--color-label);
    --button-border: var(--color-border);
  }

  &[data-variant="outline"] {
    --button-background: transparent;
    --button-background-hover: var(--color-fill-quaternary);
    --button-foreground: var(--color-label);
    --button-border: var(--color-border);
  }

  &[data-variant="ghost"] {
    --button-background: transparent;
    --button-background-hover: var(--color-fill-quaternary);
    --button-foreground: var(--color-label);
    --button-border: transparent;
  }

  &[data-variant="danger"] {
    --button-background: var(--color-danger-solid);
    --button-background-hover: color-mix(in oklab, var(--color-danger-solid) 88%, var(--color-bg));
    --button-foreground: var(--color-on-danger);
    --button-border: transparent;
  }

  &[data-full-width] {
    display: flex;
    width: 100%;
  }
`;

// Mesmo estilo do botão num âncora, para chamada que navega (site de divulgação) sem duplicar CSS.
const Anchor = Root.withComponent("a");

const Plan = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-1);
  margin-inline-start: var(--space-1);
  padding-block: var(--space-1);
  padding-inline: var(--space-2);
  font-family: var(--font-code);
  font-size: var(--text-caption-2);
  font-weight: var(--weight-regular);
  line-height: 1.2;
  letter-spacing: var(--tracking-normal);
  color: inherit;
  background-color: var(--color-fill-tertiary);
  border-radius: var(--plan-radius);

  & svg {
    width: 1em;
    height: 1em;
    fill: currentColor;
  }
`;

export function Button({
  variant = "primary",
  size = "md",
  radius = "auto",
  fullWidth = false,
  iconStart,
  iconEnd,
  iconOnly = false,
  loading = false,
  locked = false,
  href,
  plan,
  background,
  foreground,
  border,
  type = "button",
  disabled,
  style,
  children,
  ...props
}: ButtonProps) {
  const planStyle = { "--plan-radius": `${planCorner(radius, size)}px` } as CSSProperties;

  const colors = {
    ...style,
    "--button-background": background,
    "--button-foreground": foreground,
    "--button-border": border,
  } as CSSProperties;

  const shared = {
    "data-variant": variant,
    "data-size": size,
    "data-radius": radius,
    "data-icon-only": iconOnly || undefined,
    "data-loading": loading || undefined,
    "data-locked": locked || undefined,
    "data-full-width": fullWidth || undefined,
    "aria-busy": loading || undefined,
    style: colors,
    ...cornerAttributes(radius, size, iconOnly),
  };

  const content = (
    <>
      {loading && (
        <span data-button-icon>
          <Spinner size="sm" label="" />
        </span>
      )}
      {iconStart && !loading && <span data-button-icon>{matchTextWeight(iconStart)}</span>}
      {iconOnly ? <span data-button-icon>{matchTextWeight(children)}</span> : children}
      {iconEnd && <span data-button-icon>{matchTextWeight(iconEnd)}</span>}
      {locked && (
        <Plan style={planStyle} {...squirclePx(planCorner(radius, size))}>
          <LockIcon weight={iconWeight} aria-hidden="true" />
          <VisuallyHidden>{plan ? "Disponível no plano" : "Recurso bloqueado"}</VisuallyHidden>
          {plan}
        </Plan>
      )}
    </>
  );

  if (href) {
    return (
      <Anchor href={href} {...shared} {...(props as ComponentPropsWithoutRef<"a">)}>
        {content}
      </Anchor>
    );
  }

  return (
    <Root type={type} disabled={disabled || loading} {...shared} {...props}>
      {content}
    </Root>
  );
}
