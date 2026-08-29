import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { cx } from "@/lib/utils/cx";
import styles from "./progress.module.css";

type ProgressProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  value?: number;
  max?: number;
  tone?: "accent" | "success" | "warning" | "danger";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  segments?: number;
};

function fillOf(index: number, segments: number, ratio: number) {
  const fraction = ratio * segments - index;
  return Math.round(Math.min(1, Math.max(0, fraction)) * 1000) / 1000;
}

function tickStyle(vars: Record<string, number>) {
  return vars as CSSProperties;
}

export function Progress({
  value,
  max = 100,
  tone = "accent",
  size = "md",
  segments = 32,
  className,
  ...props
}: ProgressProps) {
  const indeterminate = value === undefined;
  const ratio = indeterminate ? 0 : Math.min(1, Math.max(0, value / max));

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={indeterminate ? undefined : Math.round(value)}
      className={cx(styles.track, className)}
      data-tone={tone}
      data-size={size}
      data-indeterminate={indeterminate || undefined}
      {...props}
    >
      {Array.from({ length: segments }, (_, index) => (
        <span
          key={index}
          className={styles.tick}
          style={tickStyle(indeterminate ? { "--index": index } : { "--fill": fillOf(index, segments, ratio) })}
        />
      ))}
    </div>
  );
}
