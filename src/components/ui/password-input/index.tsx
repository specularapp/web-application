"use client";

import styled from "@emotion/styled";
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Input, type InputProps } from "../input";
import { focusRing } from "../styles";

export type PasswordInputProps = Omit<InputProps, "type" | "mask">;

const Toggle = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  margin-inline-end: calc(var(--space-1) * -1);
  padding: 0;
  color: var(--color-label-secondary);
  background: transparent;
  border: 0;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-standard);

  ${focusRing};

  &:hover {
    color: var(--color-label);
  }

  & svg {
    width: 1.125rem;
    height: 1.125rem;
    fill: currentColor;
  }
`;

export function PasswordInput({ iconEnd, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      type={visible ? "text" : "password"}
      autoComplete="current-password"
      spellCheck={false}
      iconEnd={
        <>
          {iconEnd}
          <Toggle
            type="button"
            aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={visible}
            onClick={() => setVisible((state) => !state)}
          >
            {visible ? <EyeSlashIcon /> : <EyeIcon />}
          </Toggle>
        </>
      }
      {...props}
    />
  );
}
