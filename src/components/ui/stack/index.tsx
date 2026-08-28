import type { ComponentPropsWithoutRef, CSSProperties, ElementType } from "react";
import { cx } from "@/lib/utils/cx";
import styles from "./stack.module.css";

export type Space = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16;

export type StackProps = ComponentPropsWithoutRef<"div"> & {
  as?: ElementType;
  gap?: Space;
  align?: "start" | "center" | "end" | "stretch" | "baseline";
  justify?: "start" | "center" | "end" | "between";
  wrap?: boolean;
};

function Flex({
  direction,
  as: Tag = "div",
  gap = 4,
  align,
  justify,
  wrap = false,
  className,
  style,
  ...props
}: StackProps & { direction: "column" | "row" }) {
  const vars = { ...style, "--gap": gap === 0 ? "0" : `var(--space-${gap})` } as CSSProperties;
  return (
    <Tag
      className={cx(styles.flex, className)}
      data-direction={direction}
      data-align={align}
      data-justify={justify}
      data-wrap={wrap || undefined}
      style={vars}
      {...props}
    />
  );
}

export function Stack(props: StackProps) {
  return <Flex direction="column" {...props} />;
}

export function Inline(props: StackProps) {
  return <Flex direction="row" {...props} />;
}
