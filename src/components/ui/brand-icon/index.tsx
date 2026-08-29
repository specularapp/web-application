import type { IconWeight } from "@phosphor-icons/react";
import Image from "next/image";
import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { cx } from "@/lib/utils/cx";
import styles from "./brand-icon.module.css";

export type BrandIconProps = Omit<ComponentPropsWithoutRef<"span">, "children" | "color"> & {
  name: string;
  label?: string;
  color?: boolean;
  weight?: IconWeight;
};

const INTRINSIC_SIZE = 24;

export function BrandIcon({ name, label, color = false, weight: _weight, className, style, ...props }: BrandIconProps) {
  const src = `/brands/${name}.svg`;

  if (color) {
    return (
      <span
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className={cx(styles.icon, className)}
        style={style}
        {...props}
      >
        <Image src={src} alt="" width={INTRINSIC_SIZE} height={INTRINSIC_SIZE} className={styles.image} />
      </span>
    );
  }

  const vars = { ...style, "--brand-icon": `url(${src})` } as CSSProperties;
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx(styles.icon, styles.mask, className)}
      style={vars}
      {...props}
    />
  );
}
