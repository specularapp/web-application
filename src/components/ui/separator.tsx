import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/utils/cx";
import styles from "./separator.module.css";

type SeparatorProps = ComponentPropsWithoutRef<"div"> & {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
};

export function Separator({ orientation = "horizontal", decorative = true, className, ...props }: SeparatorProps) {
  return (
    <div
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      className={cx(styles.separator, className)}
      data-orientation={orientation}
      {...props}
    />
  );
}
