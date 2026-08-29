import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import { squircle, type CornerRadius } from "@/lib/corners";
import { cx } from "@/lib/utils/cx";
import { matchIconWeight } from "../icons";
import { VisuallyHidden } from "../visually-hidden";
import styles from "./badge.module.css";

export type BadgeRole = "neutral" | "brand" | "accent" | "success" | "warning" | "danger" | "info";

export type BadgeHue =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "mint"
  | "teal"
  | "cyan"
  | "blue"
  | "indigo"
  | "purple"
  | "pink"
  | "brown";

export type BadgeTone = BadgeRole | BadgeHue;

export type BadgeVariant = "soft" | "solid" | "outline";

export type BadgeSize = "sm" | "md" | "lg";

export type BadgeShape = "rounded" | "pill";

type BadgeBaseProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  shape?: BadgeShape;
  icon?: ReactNode;
  hue?: string;
};

export type BadgeProps =
  | (BadgeBaseProps & { children: ReactNode; label?: never })
  | (BadgeBaseProps & { children?: never; icon: ReactNode; label: string });

const badgeCorner: Record<BadgeSize, CornerRadius> = { sm: "sm", md: "sm", lg: "md" };

const iconWeight = "bold";

function cornerAttributes(shape: BadgeShape, size: BadgeSize, variant: BadgeVariant) {
  if (shape === "pill") return {};
  return squircle(badgeCorner[size], { clip: variant !== "outline" });
}

export function Badge({
  tone = "neutral",
  variant = "soft",
  size = "md",
  shape = "rounded",
  icon,
  hue,
  label,
  className,
  style,
  children,
  ...props
}: BadgeProps) {
  const iconOnly = label !== undefined;
  const vars = { ...style, "--badge-hue": hue } as CSSProperties;

  return (
    <span
      className={cx(styles.badge, className)}
      data-tone={tone}
      data-variant={variant}
      data-size={size}
      data-shape={shape}
      data-icon-only={iconOnly || undefined}
      style={vars}
      {...cornerAttributes(shape, size, variant)}
      {...props}
    >
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {matchIconWeight(icon, iconWeight)}
        </span>
      )}
      {iconOnly ? <VisuallyHidden>{label}</VisuallyHidden> : <span className={styles.text}>{children}</span>}
    </span>
  );
}
