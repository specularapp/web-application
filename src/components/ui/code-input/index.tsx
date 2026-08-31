"use client";

import styled from "@emotion/styled";
import { Fragment, useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from "react";
import { squircle } from "@/lib/corners";

export type CodeInputProps = {
  label: string;
  length?: number;
  groupSize?: number;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  fullWidth?: boolean;
  onChange?: (code: string) => void;
  onComplete?: (code: string) => void;
};

const Root = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);

  &[data-full-width] {
    flex-wrap: nowrap;
    gap: var(--space-1);
    width: 100%;
  }

  &[data-full-width] input:not([type="hidden"]) {
    flex: 1 1 auto;
    aspect-ratio: 1;
    height: auto;
    min-width: 0;
  }
`;

const Box = styled.input`
  width: 3rem;
  height: 4rem;
  padding: 0;
  font: inherit;
  font-size: var(--text-title-2);
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--color-label);
  caret-color: var(--color-label);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: border-color var(--duration-fast) var(--ease-standard);

  &::placeholder {
    color: var(--color-label-quaternary);
  }

  &:focus-visible {
    border-color: var(--color-label-secondary);
    outline: none;
  }

  &[data-invalid] {
    border-color: var(--color-danger);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const Dash = styled.span`
  width: 0.75rem;
  height: 2px;
  flex-shrink: 0;
  background-color: var(--color-separator);
  border-radius: var(--radius-full);
`;

export function CodeInput({
  label,
  length = 6,
  groupSize = 3,
  name,
  disabled = false,
  invalid = false,
  fullWidth = false,
  onChange,
  onComplete,
}: CodeInputProps) {
  const [digits, setDigits] = useState<string[]>(() => Array.from({ length }, () => ""));
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const emit = (next: string[]) => {
    setDigits(next);
    const code = next.join("");
    onChange?.(code);
    if (code.length === length) onComplete?.(code);
  };

  const focusBox = (index: number) => boxes.current[Math.max(0, Math.min(length - 1, index))]?.focus();

  const handleChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const digit = event.target.value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    emit(next);
    if (digit) focusBox(index + 1);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      emit(next);
      focusBox(index - 1);
    }
    if (event.key === "ArrowLeft") focusBox(index - 1);
    if (event.key === "ArrowRight") focusBox(index + 1);
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    event.preventDefault();
    const next = Array.from({ length }, (_, index) => pasted[index] ?? "");
    emit(next);
    focusBox(pasted.length);
  };

  return (
    <Root role="group" aria-label={label} data-full-width={fullWidth || undefined}>
      {digits.map((digit, index) => (
        <Fragment key={index}>
          {index > 0 && groupSize > 0 && index % groupSize === 0 && <Dash aria-hidden="true" />}
          <Box
            {...squircle("lg")}
            ref={(node) => {
              boxes.current[index] = node;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={2}
            placeholder="0"
            value={digit}
            disabled={disabled}
            data-invalid={invalid || undefined}
            aria-label={`Dígito ${index + 1} de ${length}`}
            onChange={(event) => handleChange(index, event)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            onFocus={(event) => event.target.select()}
          />
        </Fragment>
      ))}
      {name && <input type="hidden" name={name} value={digits.join("")} readOnly />}
    </Root>
  );
}
