import type { ComponentPropsWithoutRef, ElementType } from "react";
import { squircleAuto } from "@/lib/corners";
import { cx } from "@/lib/utils/cx";
import styles from "./surface.module.css";

export type SurfaceTone = "raised" | "sunken" | "plain";

export type SurfaceProps = ComponentPropsWithoutRef<"div"> & {
  as?: ElementType;
  tone?: SurfaceTone;
  pad?: "none" | "tight" | "loose";
};

export function Surface({ as: Tag = "div", tone = "raised", pad, className, ...props }: SurfaceProps) {
  return (
    <Tag
      className={cx(styles.surface, className)}
      data-tone={tone}
      data-pad={pad}
      {...squircleAuto()}
      {...props}
    />
  );
}
