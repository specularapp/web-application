import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/utils/cx";
import { VisuallyHidden } from "./visually-hidden";
import styles from "./spinner.module.css";

type SpinnerProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  size?: "sm" | "md" | "lg";
  label?: string;
};

export function Spinner({ size = "md", label = "Carregando", className, ...props }: SpinnerProps) {
  return (
    <span role="status" className={cx(styles.spinner, className)} data-size={size} {...props}>
      <VisuallyHidden>{label}</VisuallyHidden>
    </span>
  );
}
