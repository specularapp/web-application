"use client";

import styled from "@emotion/styled";
import { XIcon } from "@phosphor-icons/react";
import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";

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
  /** Teto de caracteres de cada etiqueta, o mesmo que o zod valida no servidor. */
  maxLength?: number;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

/* O mesmo invólucro dos campos da casa, só que quebrando linha: as etiquetas entram uma ao lado da outra
   e o campo de digitar fica no fim, tomando o que sobra e descendo de linha quando não cabe. */
const Shell = styled.span`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: var(--control-height-md);
  padding: var(--space-2) var(--space-3);
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

/* A etiqueta com o × dentro: bloco no preenchimento da casa, canto quase reto, com a altura fechada para
   caber na linha do campo sem recortar nada. É o chip com remoção que o Badge deixa de fora de propósito. */
const Chip = styled.span`
  display: inline-flex;
  gap: var(--space-half);
  align-items: center;
  max-width: 100%;
  height: 1.75rem;
  padding-inline: var(--space-2) var(--space-half);
  font-size: var(--text-footnote);
  font-weight: var(--weight-medium);
  line-height: 1;
  letter-spacing: var(--tracking-tight);
  color: var(--color-label);
  white-space: nowrap;
  background-color: var(--color-fill-tertiary);
  /* Canto de 2px, quase reto: a etiqueta é um bloco de texto, e em pílula competia com os botões. */
  border-radius: 0.125rem;
`;

const ChipText = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Remove = styled.button`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  color: var(--color-label-secondary);
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
      color: var(--color-label);
      background-color: var(--color-fill);
    }
  }
`;

const Control = styled.input`
  flex: 1 1 5rem;
  min-width: 0;
  max-width: 100%;
  height: 1.75rem;
  padding: 0;
  font: inherit;
  font-size: max(16px, var(--text-subheadline));
  letter-spacing: var(--tracking-tight);
  color: inherit;
  background: transparent;
  border: 0;
  outline: none;
`;

// Campo de etiquetas: o texto vira etiqueta ao apertar Enter ou vírgula (no celular também, pelo teclado
// virtual, que manda o Enter como "Concluído" e a vírgula pelo próprio texto), ou ao sair do campo; cada
// uma tem o × para tirar, e Backspace no campo vazio tira a última. Repetida não entra.
export function TagInput({
  value,
  onChange,
  placeholder,
  id,
  disabled = false,
  invalid = false,
  required,
  max,
  maxLength,
  ...aria
}: TagInputProps) {
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const full = max !== undefined && value.length >= max;

  const add = (raw: string) => {
    const tag = raw.replace(/,/g, "").trim();
    if (!tag) return;
    if (!full && !value.some((entry) => entry.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
  };

  const commit = () => {
    add(draft);
    setDraft("");
  };

  const remove = (index: number) => {
    onChange(value.filter((_, position) => position !== index));
    input.current?.focus();
  };

  // A vírgula digitada no celular não chega como tecla, e sim dentro do texto: por isso o corte é aqui.
  const onInput = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    if (text.includes(",")) {
      add(text);
      setDraft("");
      return;
    }
    setDraft(text);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.keyCode === 13) {
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
        <Chip key={tag}>
          <ChipText>{tag}</ChipText>
          <Remove type="button" aria-label={`Remover ${tag}`} disabled={disabled} onClick={() => remove(index)}>
            <XIcon weight="bold" />
          </Remove>
        </Chip>
      ))}
      <Control
        ref={input}
        id={id}
        type="text"
        value={draft}
        maxLength={maxLength}
        placeholder={value.length === 0 ? placeholder : full ? "" : "Adicionar"}
        disabled={disabled || full}
        required={required && value.length === 0}
        autoComplete="off"
        enterKeyHint="done"
        onChange={onInput}
        onKeyDown={onKeyDown}
        onBlur={commit}
        {...aria}
      />
    </Shell>
  );
}
