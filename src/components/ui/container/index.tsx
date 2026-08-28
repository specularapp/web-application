import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cx } from "@/lib/utils/cx";
import styles from "./container.module.css";

type ContainerProps = ComponentPropsWithoutRef<"div"> & {
  as?: ElementType;
  size?: "default" | "narrow" | "full";
};

export function Container({ as: Tag = "div", size = "default", className, ...props }: ContainerProps) {
  return <Tag className={cx(styles.container, className)} data-size={size} {...props} />;
}
