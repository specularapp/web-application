import Image from "next/image";
import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { squircleAuto } from "@/lib/corners";
import { cx } from "@/lib/utils/cx";
import { hashString } from "@/lib/utils/hash";
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

/* Fundo do rosto desenhado: um matiz da paleta do sistema escolhido pela semente, então a mesma pessoa
   tem sempre a mesma cor e duas pessoas lado a lado quase nunca repetem. */
const hues = ["red", "orange", "yellow", "green", "mint", "teal", "cyan", "blue", "indigo", "purple", "pink", "brown"];

export function Avatar({ name, src, seed, size = "md", shape = "circle", className, style, ...props }: AvatarProps) {
  const key = seed ?? name;
  const hue = hues[hashString(key) % hues.length];
  const vars = { ...style, ...(!src && { "--avatar-hue": `var(--sys-${hue})` }) } as CSSProperties;

  return (
    <span
      role="img"
      aria-label={name}
      className={cx(styles.avatar, className)}
      data-size={size}
      data-shape={shape}
      data-generated={src ? undefined : ""}
      style={vars}
      {...(shape === "squircle" && squircleAuto())}
      {...props}
    >
      {src ? <Image src={src} alt="" fill sizes={imageSizes[size]} className={styles.image} /> : <AvatarShape seed={key} />}
    </span>
  );
}

export type AvatarGroupProps = ComponentPropsWithoutRef<"span">;

export function AvatarGroup({ className, ...props }: AvatarGroupProps) {
  return <span className={cx(styles.group, className)} {...props} />;
}
