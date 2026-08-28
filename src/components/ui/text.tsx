import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cx } from "@/lib/utils/cx";
import styles from "./text.module.css";

export type TextVariant =
  | "largeTitle"
  | "title1"
  | "title2"
  | "title3"
  | "headline"
  | "body"
  | "callout"
  | "subheadline"
  | "footnote"
  | "caption1"
  | "caption2";

export type TextTone = "default" | "secondary" | "tertiary" | "accent" | "success" | "warning" | "danger" | "inherit";

export type TextProps = Omit<ComponentPropsWithoutRef<"p">, "color"> & {
  as?: ElementType;
  variant?: TextVariant;
  tone?: TextTone;
  font?: "body" | "display" | "code";
  weight?: "regular" | "medium" | "semibold" | "bold";
  align?: "start" | "center" | "end";
  truncate?: boolean;
  numeric?: boolean;
};

const defaultTag: Record<TextVariant, ElementType> = {
  largeTitle: "h1",
  title1: "h1",
  title2: "h2",
  title3: "h3",
  headline: "h4",
  body: "p",
  callout: "p",
  subheadline: "p",
  footnote: "p",
  caption1: "span",
  caption2: "span",
};

export function Text({
  as,
  variant = "body",
  tone = "default",
  font,
  weight,
  align,
  truncate = false,
  numeric = false,
  className,
  ...props
}: TextProps) {
  const Tag = as ?? defaultTag[variant];
  return (
    <Tag
      className={cx(styles.text, className)}
      data-variant={variant}
      data-tone={tone}
      data-font={font}
      data-weight={weight}
      data-align={align}
      data-truncate={truncate || undefined}
      data-numeric={numeric || undefined}
      {...props}
    />
  );
}
