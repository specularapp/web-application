"use client";

import styled from "@emotion/styled";
import { XIcon } from "@phosphor-icons/react";
import { useRef, useState, type KeyboardEvent } from "react";
import { Badge } from "../badge";

export type TagInputProps = {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  /** Teto de etiquetas; chegando nele o campo para de aceitar. */
  max?: number;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

/* O mesmo invólucro dos campos da casa, só que quebrando linha: as etiquetas entram uma ao lado da outra
   e o campo de digitar fica no fim, tomando o que sobra. */
const Shell = styled.span`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
  width: 100%;
  min-height: var(--control-height-md);
  padding: var(--space-1) var(--space-3);
  color: var(--color-label);
  cursor: text;
  background-color: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--control-radius-md);
  corner-shape: squircle;

  @media (max-width: 47.9375rem) {
    border-radius: var(--radius-md);
  }

  &[data-invalid] {
    border-color: var(--color-danger);
  }

  &[data-disabled] {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const Control = styled.input`
  flex: 1;
  min-width: 8rem;
  min-height: calc(var(--control-height-md) - var(--space-2));
  padding: 0;
  font: inherit;
  font-size: max(16px, var(--text-subheadline));
  letter-spacing: var(--tracking-tight);
  color: inherit;
  background: transparent;
  border: 0;
  outline: none;
`;

/* O × dentro da etiqueta: um botão pequeno que herda a tinta e ganha fundo no hover. */
const Remove = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  margin-inline-start: var(--space-half);
  padding: 0;
  color: inherit;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--radius-full);

  & svg {
    width: 0.75rem;
    height: 0.75rem;
  }

  @media (hover: hover) {
    &:hover {
      background-color: var(--color-fill);
    }
  }
`;

// Campo de etiquetas: o texto vira etiqueta ao apertar Enter ou vírgula (ou ao sair do campo), cada uma
// com o × para tirar, e Backspace no campo vazio tira a última. Repetida não entra. É o chip com remoção
// que o `Badge` deixa de propósito para fora: interativo, então mora aqui.
export function TagInput({
  value,
  onChange,
  placeholder,
  id,
  disabled = false,
  invalid = false,
  required,
  max,
  ...aria
}: TagInputProps) {
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const full = max !== undefined && value.length >= max;

  const commit = () => {
    const tag = draft.trim().replace(/,+$/, "").trim();
    if (!tag) return;
    if (!full && !value.some((entry) => entry.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setDraft("");
  };

  const remove = (index: number) => {
    onChange(value.filter((_, position) => position !== index));
    input.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit();
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      event.preventDefault();
      remove(value.length - 1);
    }
  };

  return (
    <Shell data-invalid={invalid || undefined} data-disabled={disabled || undefined} onClick={() => input.current?.focus()}>
      {value.map((tag, index) => (
        <Badge key={tag} tone="neutral" size="md">
          {tag}
          <Remove type="button" aria-label={`Remover ${tag}`} disabled={disabled} onClick={() => remove(index)}>
            <XIcon weight="bold" />
          </Remove>
        </Badge>
      ))}
      <Control
        ref={input}
        id={id}
        type="text"
        value={draft}
        placeholder={value.length === 0 ? placeholder : full ? "" : "Adicionar"}
        disabled={disabled || full}
        required={required && value.length === 0}
        autoComplete="off"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        {...aria}
      />
    </Shell>
  );
}
