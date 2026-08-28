import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "@/lib/utils/cx";
import styles from "./link.module.css";

type TextLinkProps = ComponentProps<typeof Link> & {
  tone?: "accent" | "inherit";
  underline?: "hover" | "always";
};

export function TextLink({ tone = "accent", underline = "hover", className, ...props }: TextLinkProps) {
  return <Link className={cx(styles.link, className)} data-tone={tone} data-underline={underline} {...props} />;
}
