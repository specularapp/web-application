import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/utils/cx";
import styles from "./label.module.css";

type LabelProps = ComponentPropsWithoutRef<"label"> & { required?: boolean };

export function Label({ required = false, className, children, ...props }: LabelProps) {
  return (
    <label className={cx(styles.label, className)} {...props}>
      {children}
      {required && (
        <span className={styles.required} aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}
