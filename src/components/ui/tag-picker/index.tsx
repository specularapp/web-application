"use client";

import styled from "@emotion/styled";
import { PlusIcon, XIcon } from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { Text } from "@/components/ui/text";
import { squircle } from "@/lib/corners";
import { MAX_TAGS, type TagCatalog } from "@/lib/tags";

/* A fila das escolhidas mais o gatilho do leque, quebrando linha quando não cabe. */
const Shell = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  min-width: 0;
`;

/* Cada etiqueta escolhida: a bolinha da cor dela, o nome e o X de tirar. */
const Chip = styled.span`
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  max-width: 100%;
  min-width: 0;
  padding: var(--space-1) var(--space-1) var(--space-1) var(--space-3);
  background-color: var(--color-fill-tertiary);
  border-radius: var(--radius-md);
`;

const Dot = styled.span`
  flex: none;
  width: 0.5rem;
  height: 0.5rem;
  background-color: var(--dot-hue);
  border-radius: var(--radius-full);
`;

const Remove = styled.button`
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  color: var(--color-label-secondary);
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: var(--radius-full);
  transition:
    color var(--duration-fast) var(--ease-standard),
    background-color var(--duration-fast) var(--ease-standard);

  & svg {
    width: 0.75rem;
    height: 0.75rem;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  @media (hover: hover) {
    &:not(:disabled):hover {
      color: var(--color-label);
      background-color: var(--color-fill-secondary);
    }
  }

  &:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }
`;

const dotStyle = (hue: string) => ({ "--dot-hue": hue }) as CSSProperties;

/** A bolinha do matiz de uma etiqueta, para quem desenha a fila fora do seletor. */
export function TagDot({ hue }: { hue: string }) {
  return <Dot style={dotStyle(hue)} aria-hidden="true" />;
}

/**
 * As seções do leque, por família, com a bolinha do matiz em cada opção.
 *
 * Exportado porque a ficha da tarefa mostra as etiquetas de outro jeito, com a própria fila servindo de
 * gatilho, no desenho de ficha de propriedades, e mesmo assim precisa exatamente destas opções. Sem isto
 * eram duas montagens iguais em arquivos diferentes, e a segunda divergiria da primeira no primeiro acerto.
 */
export function tagSections(
  catalog: TagCatalog,
  value: string[],
  onChange: (tags: string[]) => void,
  max = MAX_TAGS,
): DropdownSection[] {
  const full = value.length >= max;

  return catalog.groups.map((group) => ({
    id: `tags-${group}`,
    label: group,
    items: catalog.inGroup(group).map((tag) => ({
      kind: "toggle" as const,
      id: `tag-${tag.id}`,
      label: tag.id,
      media: <Dot style={dotStyle(tag.hue)} />,
      checked: value.includes(tag.id),
      /* Fora do teto, marcar não faz nada; desmarcar continua livre, senão não haveria como abrir espaço. */
      onChange: (checked: boolean) => {
        if (checked && full) return;
        onChange(checked ? [...value, tag.id] : value.filter((entry) => entry !== tag.id));
      },
    })),
  }));
}

export type TagPickerProps = {
  /** A gama do domínio, montada por `createTagCatalog`. */
  catalog: TagCatalog;
  value: string[];
  onChange: (tags: string[]) => void;
  /** O que o leitor de tela ouve no gatilho: "Etiquetas do projeto", "Etiquetas do cliente". */
  label: string;
  id?: string;
  disabled?: boolean;
  /** Teto de etiquetas; chegando nele, o que não foi escolhido para de aceitar. */
  max?: number;
  "aria-describedby"?: string;
};

/**
 * O seletor de etiquetas da casa, um só para todos os domínios.
 *
 * Etiqueta é escolha de uma gama pronta, e nunca texto livre (regra de `lib/tags.ts`): o leque abre por
 * família, cada opção com a bolinha do próprio matiz, e as escolhidas ficam em fila com o X de tirar.
 *
 * Antes disto havia duas cópias do mesmo componente, uma na ficha do projeto e outra na da tarefa, e três
 * telas ainda usavam campo de texto livre, o que deixava "Web design", "web-design" e "Webdesign"
 * convivendo na mesma base e no mesmo filtro.
 */
export function TagPicker({
  catalog,
  value,
  onChange,
  label,
  id,
  disabled,
  max = MAX_TAGS,
  "aria-describedby": describedBy,
}: TagPickerProps) {
  const full = value.length >= max;

  return (
    <Shell id={id} aria-describedby={describedBy}>
      {value.map((tag) => (
        <Chip key={tag} {...squircle("md")}>
          <TagDot hue={catalog.hueOf(tag)} />
          <Text as="span" variant="footnote" weight="medium" truncate>
            {tag}
          </Text>
          <Remove
            type="button"
            aria-label={`Remover ${tag}`}
            disabled={disabled}
            onClick={() => onChange(value.filter((entry) => entry !== tag))}
          >
            <XIcon weight="bold" />
          </Remove>
        </Chip>
      ))}

      <DropdownMenu
        label={label}
        triggerLabel={value.length === 0 ? "Escolher etiquetas" : "Adicionar etiquetas"}
        icon={<PlusIcon />}
        trigger={{ variant: "outline", radius: "md", disabled }}
        sections={tagSections(catalog, value, onChange, max)}
      />

      {/* Uma frase só, e nunca as duas: ou não há etiqueta nenhuma, ou o teto foi alcançado. */}
      {value.length === 0 && (
        <Text as="span" variant="footnote" tone="secondary">
          Nenhuma ainda
        </Text>
      )}
      {full && (
        <Text as="span" variant="footnote" tone="secondary">
          Limite de {max}
        </Text>
      )}
    </Shell>
  );
}
