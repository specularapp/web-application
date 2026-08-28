import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { cx } from "@/lib/utils/cx";
import styles from "./logo.module.css";

const variants = {
  icon: { file: "specular-icon-black.svg", ratio: "1 / 1" },
  logo: { file: "specular-logo-black.svg", ratio: "512 / 360" },
  logotipo: { file: "specular-logotipo-black.svg", ratio: "700 / 150" },
} as const;

type LogoProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  variant?: keyof typeof variants;
  height?: number;
  label?: string;
};

export function Logo({ variant = "logotipo", height = 28, label = "Specular", className, style, ...props }: LogoProps) {
  const { file, ratio } = variants[variant];
  const vars = {
    ...style,
    "--logo-image": `url(/logotipo/${file})`,
    "--logo-height": `${height / 16}rem`,
    "--logo-ratio": ratio,
  } as CSSProperties;

  return <span role="img" aria-label={label} className={cx(styles.logo, className)} style={vars} {...props} />;
}
