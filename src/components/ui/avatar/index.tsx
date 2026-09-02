import Image from "next/image";
import type { ComponentPropsWithoutRef } from "react";
import { squircleAuto } from "@/lib/corners";
import { cx } from "@/lib/utils/cx";
import styles from "./avatar.module.css";
import { AvatarShape } from "./shape";

export type AvatarSize = "xs" | "sm" | "md" | "lg";

export type AvatarShapeName = "circle" | "squircle";

export type AvatarProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  name: string;
  src?: string;
  seed?: string;
  size?: AvatarSize;
  shape?: AvatarShapeName;
};

const imageSizes: Record<AvatarSize, string> = { xs: "24px", sm: "36px", md: "44px", lg: "52px" };

export function Avatar({ name, src, seed, size = "md", shape = "circle", className, ...props }: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={name}
      className={cx(styles.avatar, className)}
      data-size={size}
      data-shape={shape}
      {...(shape === "squircle" && squircleAuto())}
      {...props}
    >
      {src ? (
        <Image src={src} alt="" fill sizes={imageSizes[size]} className={styles.image} />
      ) : (
        <AvatarShape seed={seed ?? name} size={size} />
      )}
    </span>
  );
}

export type AvatarGroupProps = ComponentPropsWithoutRef<"span">;

export function AvatarGroup({ className, ...props }: AvatarGroupProps) {
  return <span className={cx(styles.group, className)} {...props} />;
}
