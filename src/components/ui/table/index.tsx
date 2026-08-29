import type { ComponentPropsWithoutRef } from "react";
import { squircle } from "@/lib/corners";
import { cx } from "@/lib/utils/cx";
import styles from "./table.module.css";

type TableScrollProps = ComponentPropsWithoutRef<"div"> & { label: string };

export function TableScroll({ label, className, ...props }: TableScrollProps) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cx(styles.scroll, className)}
      {...squircle("lg", { color: "var(--color-separator)" })}
      {...props}
    />
  );
}

type TableProps = ComponentPropsWithoutRef<"table"> & { density?: "default" | "compact" };

export function Table({ density = "default", className, ...props }: TableProps) {
  return <table className={cx(styles.table, className)} data-density={density} {...props} />;
}

export function TableHead(props: ComponentPropsWithoutRef<"thead">) {
  return <thead className={styles.head} {...props} />;
}

export function TableBody(props: ComponentPropsWithoutRef<"tbody">) {
  return <tbody {...props} />;
}

export function TableRow({ className, ...props }: ComponentPropsWithoutRef<"tr">) {
  return <tr className={cx(styles.row, className)} {...props} />;
}

type CellProps = { align?: "start" | "center" | "end" };

export function TableHeaderCell({
  align = "start",
  className,
  scope = "col",
  ...props
}: Omit<ComponentPropsWithoutRef<"th">, "align"> & CellProps) {
  return <th scope={scope} className={cx(styles.headerCell, className)} data-align={align} {...props} />;
}

export function TableCell({
  align = "start",
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<"td">, "align"> & CellProps) {
  return <td className={cx(styles.cell, className)} data-align={align} {...props} />;
}
