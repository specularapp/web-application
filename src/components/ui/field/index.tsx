import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { cx } from "@/lib/utils/cx";
import { Label } from "../label";
import { Text } from "../text";
import styles from "./field.module.css";

type ControlProps = {
  id?: string;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  id?: string;
  className?: string;
  children: ReactElement<ControlProps>;
};

export function Field({ label, hint, error, required = false, id: idProp, className, children }: FieldProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  const control = isValidElement<ControlProps>(children)
    ? cloneElement(children, {
        id,
        required,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })
    : children;

  return (
    <div className={cx(styles.field, className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {control}
      {hint && (
        <Text id={hintId} variant="footnote" tone="secondary">
          {hint}
        </Text>
      )}
      {error && (
        <Text id={errorId} variant="footnote" tone="danger" role="alert">
          {error}
        </Text>
      )}
    </div>
  );
}
