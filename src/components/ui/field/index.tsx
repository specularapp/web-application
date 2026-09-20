"use client";

import { QuestionIcon } from "@phosphor-icons/react";
import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type FocusEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { cx } from "@/lib/utils/cx";
import { Label } from "../label";
import { Tooltip } from "../tooltip";
import { VisuallyHidden } from "../visually-hidden";
import styles from "./field.module.css";

type ControlProps = {
  id?: string;
  required?: boolean;
  iconEnd?: ReactNode;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

/**
 * O campo é o rótulo e o controle, e nada mais (2026-09-20, a pedido): a observação embaixo saiu de todos os
 * formulários da casa e a prop deixou de existir, para não voltar por descuido. Cada linha de explicação
 * custava a altura de um campo inteiro numa janela que já rola, e o que ela dizia ou já estava no rótulo ou
 * cabia no texto de exemplo do controle. O erro continua, porque ele é resposta ao que a pessoa fez.
 */
type FieldProps = {
  label: ReactNode;
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
  const errorId = `${id}-error`;

  const showError = Boolean(error) && (revealError ?? touched);
  const describedBy = showError ? errorId : undefined;

  const control = isValidElement<ControlProps>(children)
    ? cloneElement(children, {
        id,
        ...(required && { required }),
        "aria-describedby": describedBy,
        "aria-invalid": showError || undefined,
        /* Com erro, o campo troca o adorno da ponta pelo "?" que mostra a mensagem; sem erro, o que o
           controle já trazia fica (acerto de 2026-09-09: antes o campo mandava nada e apagava o
           adorno de quem o montava, como o informativo das parcelas do orçamento). */
        iconEnd: showError ? (
          <Tooltip content={error} align="end" open>
            <button type="button" className={styles.errorTrigger} aria-label="Ver o erro deste campo">
              <QuestionIcon />
            </button>
          </Tooltip>
        ) : children.props.iconEnd,
      })
    : children;

  return (
    <div
      className={cx(styles.field, className)}
      onBlurCapture={(event: FocusEvent<HTMLDivElement>) => {
        if (isFilledControl(event.target)) setTouched(true);
      }}
    >
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {control}
      {showError && (
        <VisuallyHidden id={errorId} role="alert">
          {error}
        </VisuallyHidden>
      )}
    </div>
  );
}
