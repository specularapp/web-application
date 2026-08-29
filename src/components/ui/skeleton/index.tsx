import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { squircle } from "@/lib/corners";
import { cx } from "@/lib/utils/cx";
import styles from "./skeleton.module.css";

type SkeletonProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  shape?: "text" | "rect" | "circle";
  width?: string | number;
  height?: string | number;
};

export function Skeleton({ shape = "text", width, height, className, style, ...props }: SkeletonProps) {
  const size = { ...style, width, height } as CSSProperties;
  return (
    <span
      aria-hidden="true"
      className={cx(styles.skeleton, className)}
      data-shape={shape}
      style={size}
      {...(shape === "circle" ? {} : squircle(shape === "text" ? "sm" : "md"))}
      {...props}
    />
  );
}
