"use client";

import styled from "@emotion/styled";
import { CaretDownIcon, CaretUpIcon, CheckIcon } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { disabledState, popIn, thinScrollbar } from "../styles";

export type ListboxValue = string | number;

export type ListboxOption<T extends ListboxValue> = { value: T; label: string };

export type ListboxPlacement = "below" | "above";

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
  padding: var(--space-1);
  background-color: var(--color-bg-grouped-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
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
  gap: var(--space-half);
  max-height: 14rem;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
  outline: none;
  ${thinScrollbar};
`;

const Option = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: 2.25rem;
  padding-inline: var(--space-3) var(--space-2);
  font-size: var(--text-subheadline);
  font-variant-numeric: tabular-nums;
  letter-spacing: var(--tracking-tight);
  white-space: nowrap;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard);

  &[data-active] {
    background-color: var(--color-fill-quaternary);
  }

  &[aria-selected="true"] {
    font-weight: var(--weight-semibold);
    background-color: var(--color-fill-tertiary);
  }

  & svg {
    width: 1rem;
    height: 1rem;
    color: var(--color-label);
    fill: currentColor;
  }
`;

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
}: ListboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(value);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const valueIndex = options.findIndex((option) => option.value === value);
  const activeIndex = options.findIndex((option) => option.value === active);
  const Caret = placement === "above" ? CaretUpIcon : CaretDownIcon;

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const choose = (next: T) => {
    onChange(next);
    close();
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
      const next = options[Math.min(options.length - 1, Math.max(0, activeIndex + delta))];
      if (next) setActive(next.value);
    };

    switch (event.key) {
      case "ArrowDown":
        return step(1);
      case "ArrowUp":
        return step(-1);
      case "Home":
        return step(-options.length);
      case "End":
        return step(options.length);
      case "Enter":
      case " ":
        event.preventDefault();
        return choose(active);
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
          setActive(value);
          setOpen((state) => !state);
        }}
      >
        {prefix && <Prefix>{prefix}</Prefix>}
        <Value>{selected?.label ?? placeholder}</Value>
        <Caret weight="bold" aria-hidden="true" />
      </Trigger>
      {open && (
        <List data-placement={placement}>
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
                data-active={option.value === active || undefined}
                onPointerMove={() => setActive(option.value)}
                onClick={() => choose(option.value)}
              >
                {option.label}
                {option.value === value && <CheckIcon weight="bold" aria-hidden="true" />}
              </Option>
            ))}
          </Scroll>
        </List>
      )}
    </Menu>
  );
}
