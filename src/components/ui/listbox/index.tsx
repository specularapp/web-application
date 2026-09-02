"use client";

import styled from "@emotion/styled";
import { CaretDownIcon, CaretUpIcon, CheckIcon } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { disabledState, popIn, thinScrollbar } from "../styles";

export type ListboxValue = string | number;

export type ListboxOption<T extends ListboxValue> = { value: T; label: string };

export type ListboxAction = {
  label: string;
  onSelect: () => void;
  tone?: "danger";
  /** Ícone da ação, antes do rótulo, com o respiro padrão da lista entre os dois. */
  icon?: ReactNode;
};

export type ListboxPlacement = "below" | "above" | "auto";

export type ListboxProps<T extends ListboxValue> = {
  label: string;
  options: ListboxOption<T>[];
  value: T;
  onChange: (value: T) => void;
  placement?: ListboxPlacement;
  prefix?: ReactNode;
  disabled?: boolean;
  className?: string;
  id?: string;
  fullWidth?: boolean;
  placeholder?: string;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  actions?: ListboxAction[];
};

const Menu = styled.div`
  position: relative;
  display: inline-flex;

  &[data-full-width] {
    display: flex;
    width: 100%;
  }
`;

const Trigger = styled.button`
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: var(--listbox-trigger-height, 2rem);
  padding-inline: var(--listbox-trigger-padding, var(--space-3)) var(--space-2);
  font: inherit;
  font-size: var(--listbox-trigger-font-size, inherit);
  font-weight: var(--listbox-trigger-weight, var(--weight-semibold));
  letter-spacing: var(--tracking-tight);
  white-space: nowrap;
  color: var(--color-label);
  background-color: var(--listbox-trigger-background, var(--color-fill-quaternary));
  border: 1px solid var(--listbox-trigger-border, transparent);
  border-radius: var(--listbox-trigger-radius, var(--radius-sm));
  corner-shape: squircle;
  transition: background-color var(--duration-fast) var(--ease-standard);

  ${disabledState};

  &[data-full-width] {
    flex: 1;
    justify-content: space-between;
    min-width: 0;
  }

  &[data-empty] {
    font-weight: var(--weight-regular);
    color: var(--color-placeholder);
  }

  &[data-invalid] {
    border-color: var(--color-danger);
  }

  &:hover:not(:disabled),
  &[aria-expanded="true"] {
    background-color: var(--listbox-trigger-background-hover, var(--color-fill-tertiary));
  }

  &:focus-visible {
    outline: 2px solid var(--color-label);
    outline-offset: -2px;
  }

  & svg {
    flex-shrink: 0;
    width: var(--listbox-caret-size, 0.875rem);
    height: var(--listbox-caret-size, 0.875rem);
    color: var(--color-label-secondary);
    fill: currentColor;
  }
`;

const Prefix = styled.span`
  margin-inline-end: var(--space-1);
  font-weight: var(--weight-regular);
  color: var(--color-label-secondary);
`;

const Value = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const List = styled.div`
  position: absolute;
  inset-inline-start: 0;
  z-index: var(--z-dropdown);
  min-width: max(100%, 10rem);
  width: max-content;
  padding-block: var(--space-1);
  background-color: var(--color-bg-grouped-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--listbox-trigger-radius, var(--radius-md));
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
  animation: ${popIn} var(--duration-fast) var(--ease-standard);

  &[data-placement="below"] {
    top: calc(100% + var(--space-1));
    transform-origin: top left;
    --slide: calc(var(--space-1) * -1);
  }

  &[data-placement="above"] {
    bottom: calc(100% + var(--space-1));
    transform-origin: bottom left;
    --slide: var(--space-1);
  }
`;

const Scroll = styled.ul`
  position: relative;
  display: grid;
  gap: var(--space-1);
  max-height: 14rem;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  overflow-y: auto;
  list-style: none;
  outline: none;
  ${thinScrollbar};
`;

// Respiro de 8px por item, nos quatro lados, e 8px entre o rótulo e o ícone. O recuo lateral do painel
// mora aqui, na margem do item, e não no painel: assim o divisor nasce de ponta a ponta sem margem
// negativa, que era o que abria rolagem horizontal dentro da lista. O raio é o do painel menos esse
// recuo (12 menos 4), então o encaixe é concêntrico, e o canto é superelipse declarada direto, como no
// painel: item de listbox não entra no recorte do motor de cantos, porque a lista sai do container.
const Option = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: 2.25rem;
  margin-inline: var(--space-1);
  padding: var(--space-2);
  font-size: var(--text-subheadline);
  font-variant-numeric: tabular-nums;
  letter-spacing: var(--tracking-tight);
  white-space: nowrap;
  border-radius: max(var(--radius-xs), calc(var(--listbox-trigger-radius, var(--radius-md)) - var(--space-1)));
  corner-shape: squircle;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard);

  &[data-active] {
    background-color: var(--color-fill-quaternary);
  }

  &[aria-selected="true"] {
    font-weight: var(--weight-semibold);
    background-color: var(--color-fill-tertiary);
  }

  /* Ação lê corrido, ícone e rótulo juntos: o space-between é das opções, que precisam do check na
     outra ponta. */
  &[data-kind="action"] {
    justify-content: flex-start;
  }

  &[data-tone="danger"] {
    color: var(--color-danger);
  }

  /* Hover da ação que destrói acende em vermelho, e não no cinza das opções. O atributo data-active é o
     hover deste componente: o ponteiro passando por cima o move de item em item, e a seta do teclado usa
     o mesmo estado. A tinta é a fórmula do Badge, o matiz em alfa baixo, mais forte no escuro, para
     assentar sobre qualquer superfície em vez de virar bloco chapado. */
  &[data-tone="danger"][data-active] {
    background-color: light-dark(
      color-mix(in oklab, var(--color-danger) 14%, transparent),
      color-mix(in oklab, var(--color-danger) 20%, transparent)
    );
  }

  & svg {
    width: 1rem;
    height: 1rem;
    color: var(--color-label);
    fill: currentColor;
  }

  &[data-tone="danger"],
  &[data-tone="danger"] svg {
    color: var(--color-danger);
  }
`;

/* A linha vai de ponta a ponta: quem recua é o item, então ela não precisa de margem negativa para
   escapar do painel, e sem margem negativa não há nada mais largo que a lista para criar rolagem. A cor é
   a da borda do próprio painel, a mais discreta da paleta; a de separador é quase três vezes mais opaca e
   pesava demais num painel deste tamanho. */
const Divider = styled.li`
  height: 1px;
  margin-block: var(--space-1);
  background-color: var(--color-border);
`;

const OPTION_HEIGHT = 36;
const LIST_MAX_HEIGHT = 224;
const VIEWPORT_MARGIN = 16;

// Estimativa em vez de medição: medir só depois de montar faria a lista aparecer embaixo e pular
// para cima no mesmo quadro. A altura da opção é fixa no CSS, então a conta erra pouco.
function resolvePlacement(placement: ListboxPlacement, trigger: HTMLElement | null, count: number) {
  if (placement !== "auto") return placement;
  if (!trigger) return "below";

  const rect = trigger.getBoundingClientRect();
  const needed = Math.min(count * OPTION_HEIGHT + VIEWPORT_MARGIN, LIST_MAX_HEIGHT) + VIEWPORT_MARGIN;
  const below = window.innerHeight - rect.bottom;
  return below < needed && rect.top > below ? "above" : "below";
}

function revealOption(list: HTMLElement, option: HTMLElement) {
  const top = option.offsetTop;
  const bottom = top + option.offsetHeight;
  if (top < list.scrollTop) list.scrollTop = top;
  else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
}

export function Listbox<T extends ListboxValue>({
  label,
  options,
  value,
  onChange,
  placement = "below",
  prefix,
  disabled = false,
  className,
  id,
  fullWidth = false,
  placeholder,
  required = false,
  invalid = false,
  describedBy,
  actions = [],
}: ListboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<Exclude<ListboxPlacement, "auto">>(placement === "above" ? "above" : "below");
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const valueIndex = options.findIndex((option) => option.value === value);
  const total = options.length + actions.length;
  const Caret = side === "above" ? CaretUpIcon : CaretDownIcon;

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  // Ação e opção dividem a mesma navegação, por isso o índice manda no lugar do valor: só assim a
  // seta chega no item de remover, que não é um valor possível do campo.
  const pick = (index: number) => {
    const option = options[index];
    if (option) {
      onChange(option.value);
      close();
      return;
    }
    const action = actions[index - options.length];
    if (!action) return;
    close();
    action.onSelect();
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const current = document.getElementById(`${listId}-${valueIndex}`);
    if (!list || !current) return;
    list.focus({ preventScroll: true });
    list.scrollTop = current.offsetTop;
  }, [open, valueIndex, listId]);

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const option = document.getElementById(`${listId}-${activeIndex}`);
    if (list && option) revealOption(list, option);
  }, [open, activeIndex, listId]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    const step = (delta: number) => {
      event.preventDefault();
      setActiveIndex(Math.min(total - 1, Math.max(0, activeIndex + delta)));
    };

    switch (event.key) {
      case "ArrowDown":
        return step(1);
      case "ArrowUp":
        return step(-1);
      case "Home":
        return step(-total);
      case "End":
        return step(total);
      case "Enter":
      case " ":
        event.preventDefault();
        return pick(activeIndex);
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        return close();
      case "Tab":
        return close(false);
    }
  };

  return (
    <Menu ref={menuRef} className={className} data-full-width={fullWidth || undefined}>
      <Trigger
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        data-full-width={fullWidth || undefined}
        data-empty={!selected && placeholder ? "" : undefined}
        data-invalid={invalid || undefined}
        aria-label={prefix ? undefined : label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => {
          setActiveIndex(Math.max(0, valueIndex));
          setSide(resolvePlacement(placement, triggerRef.current, total));
          setOpen((state) => !state);
        }}
      >
        {prefix && <Prefix>{prefix}</Prefix>}
        <Value>{selected?.label ?? placeholder}</Value>
        <Caret weight="bold" aria-hidden="true" />
      </Trigger>
      {open && (
        <List data-placement={side}>
          <Scroll
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            aria-activedescendant={`${listId}-${activeIndex}`}
            tabIndex={-1}
            onKeyDown={onKeyDown}
          >
            {options.map((option, index) => (
              <Option
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.value === value}
                data-active={index === activeIndex || undefined}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => pick(index)}
              >
                {option.label}
                {option.value === value && <CheckIcon weight="bold" aria-hidden="true" />}
              </Option>
            ))}

            {actions.length > 0 && <Divider role="presentation" />}

            {actions.map((action, position) => {
              const index = options.length + position;
              return (
                <Option
                  key={action.label}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={false}
                  data-active={index === activeIndex || undefined}
                  data-tone={action.tone}
                  onPointerMove={() => setActiveIndex(index)}
                  data-kind="action"
                  onClick={() => pick(index)}
                >
                  {action.icon}
                  {action.label}
                </Option>
              );
            })}
          </Scroll>
        </List>
      )}
    </Menu>
  );
}
