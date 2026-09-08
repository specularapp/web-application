"use client";

import styled from "@emotion/styled";
import type { ComponentPropsWithoutRef, CSSProperties, Ref } from "react";
import { FieldShell } from "../field-shell";
import type { ControlSize } from "../styles";

export type TextareaProps = Omit<ComponentPropsWithoutRef<"textarea">, "size"> & {
  size?: ControlSize;
  invalid?: boolean;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLTextAreaElement>;
};

/* O controle cru dentro do mesmo invólucro dos outros campos: quem desenha borda, raio e estado é o
   `FieldShell`. Cresce com as linhas e a pessoa pode puxar a alça para baixo; nunca para o lado, porque a
   largura é do formulário. */
const Control = styled.textarea`
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 6rem;
  padding: var(--space-3) 0;
  font: inherit;
  line-height: var(--leading-normal);
  letter-spacing: var(--tracking-tight);
  color: inherit;
  resize: vertical;
  background: transparent;
  border: 0;

  @media (hover: hover) {
    &:focus-visible {
      outline: none;
    }
  }
`;

// Campo de texto corrido, para anotações e descrições: o `Input` da casa esticado em linhas, com o mesmo
// invólucro, o mesmo piso de fonte e o mesmo estado de erro.
export function Textarea({ size = "md", invalid = false, className, style, rows = 4, ...props }: TextareaProps) {
  const flagged = invalid || props["aria-invalid"] === true || props["aria-invalid"] === "true";

  return (
    <FieldShell size={size} invalid={flagged} className={className} style={style}>
      <Control rows={rows} {...props} aria-invalid={flagged || undefined} />
    </FieldShell>
  );
}
