import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cx } from "@/lib/utils/cx";
import styles from "./visually-hidden.module.css";

type VisuallyHiddenProps = ComponentPropsWithoutRef<"span"> & { as?: ElementType };

export function VisuallyHidden({ as: Tag = "span", className, ...props }: VisuallyHiddenProps) {
  return <Tag className={cx(styles.hidden, className)} {...props} />;
}
