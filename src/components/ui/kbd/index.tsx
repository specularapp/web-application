import type { ComponentPropsWithoutRef } from "react";
import { squircle } from "@/lib/corners";
import { cx } from "@/lib/utils/cx";
import styles from "./kbd.module.css";

export function Kbd({ className, ...props }: ComponentPropsWithoutRef<"kbd">) {
  return <kbd className={cx(styles.kbd, className)} {...squircle("sm")} {...props} />;
}
