"use client";

import { QuestionIcon } from "@phosphor-icons/react";
import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type CSSProperties,
  type FocusEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { cx } from "@/lib/utils/cx";
import type { ControlSize } from "../styles";
import { Label } from "../label";
import { Text } from "../text";
import { Tooltip } from "../tooltip";
import { VisuallyHidden } from "../visually-hidden";
import styles from "./field.module.css";

type ControlProps = {
  id?: string;
  size?: ControlSize;
  required?: boolean;
  iconEnd?: ReactNode;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  revealError?: boolean;
  id?: string;
  className?: string;
  children: ReactElement<ControlProps>;
};

function isFilledControl(target: EventTarget) {
  return (
    (target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement) &&
    target.value !== ""
  );
}

export function Field({
  label,
  hint,
  error,
  required = false,
  revealError,
  id: idProp,
  className,
  children,
}: FieldProps) {
  const [touched, setTouched] = useState(false);
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const size = (isValidElement<ControlProps>(children) && children.props.size) || "md";
  const inset = { "--field-inset": `calc(var(--control-padding-${size}) + 1px)` } as CSSProperties;
  const showError = Boolean(error) && (revealError ?? touched);
  const describedBy = [hint ? hintId : null, showError ? errorId : null].filter(Boolean).join(" ") || undefined;

  const control = isValidElement<ControlProps>(children)
    ? cloneElement(children, {
        id,
        required,
        "aria-describedby": describedBy,
        "aria-invalid": showError || undefined,
        iconEnd: showError ? (
          <Tooltip content={error} align="end" open>
            <button type="button" className={styles.errorTrigger} aria-label="Ver o erro deste campo">
              <QuestionIcon />
            </button>
          </Tooltip>
        ) : undefined,
      })
    : children;

  return (
    <div
      className={cx(styles.field, className)}
      style={inset}
      onBlurCapture={(event: FocusEvent<HTMLDivElement>) => {
        if (isFilledControl(event.target)) setTouched(true);
      }}
    >
      <Label htmlFor={id} required={required} className={styles.label}>
        {label}
      </Label>
      {control}
      {hint && (
        <Text id={hintId} variant="footnote" tone="secondary" className={styles.hint}>
          {hint}
        </Text>
      )}
      {showError && (
        <VisuallyHidden id={errorId} role="alert">
          {error}
        </VisuallyHidden>
      )}
    </div>
  );
}
