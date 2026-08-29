import type { ReactNode } from "react";
import { Button, type ButtonProps } from "../button";

export type IconButtonProps = Omit<
  ButtonProps,
  "iconStart" | "iconEnd" | "iconOnly" | "fullWidth" | "children" | "aria-label"
> & {
  label: string;
  children: ReactNode;
};

export function IconButton({ label, children, ...props }: IconButtonProps) {
  return (
    <Button iconOnly aria-label={label} {...props}>
      {children}
    </Button>
  );
}
