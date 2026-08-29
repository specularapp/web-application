import Image from "next/image";
import type { ComponentPropsWithoutRef } from "react";
import { squircleAuto } from "@/lib/corners";
import { cx } from "@/lib/utils/cx";
import styles from "./avatar.module.css";

export type AvatarSize = "xs" | "sm" | "md" | "lg";

export type AvatarShape = "circle" | "squircle";

export type AvatarProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  name: string;
  src?: string;
  size?: AvatarSize;
  shape?: AvatarShape;
};

const imageSizes: Record<AvatarSize, string> = { xs: "24px", sm: "36px", md: "44px", lg: "52px" };

function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.charAt(0) ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? "") : "";
  return (first + last).toLocaleUpperCase("pt-BR");
}

export function Avatar({ name, src, size = "md", shape = "circle", className, ...props }: AvatarProps) {
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
      {src ? <Image src={src} alt="" fill sizes={imageSizes[size]} className={styles.image} /> : initialsOf(name)}
    </span>
  );
}

export type AvatarGroupProps = ComponentPropsWithoutRef<"span">;

export function AvatarGroup({ className, ...props }: AvatarGroupProps) {
  return <span className={cx(styles.group, className)} {...props} />;
}
