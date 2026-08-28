import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { cx } from "@/lib/utils/cx";
import styles from "./progress.module.css";

type ProgressProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  value?: number;
  max?: number;
  tone?: "accent" | "success" | "warning" | "danger";
  size?: "sm" | "md";
};

export function Progress({ value, max = 100, tone = "accent", size = "md", className, style, ...props }: ProgressProps) {
  const indeterminate = value === undefined;
  const percent = indeterminate ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  const vars = { ...style, "--progress": `${percent}%` } as CSSProperties;

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
      style={vars}
      {...props}
    >
      <div className={styles.bar} />
    </div>
  );
}
