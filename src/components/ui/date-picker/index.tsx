"use client";

import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";
import { CalendarBlankIcon, CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { DayPicker, useDayPicker } from "react-day-picker";
import { createPortal } from "react-dom";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { FieldAdornment, FieldShell } from "../field-shell";
import { thinScrollbar, type ControlSize } from "../styles";

export type DatePickerProps = {
  id?: string;
  name?: string;
  value?: Date;
  defaultValue?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  size?: ControlSize;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  min?: Date;
  max?: Date;
  iconEnd?: ReactNode;
  className?: string;
  style?: CSSProperties;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

const GAP = 8;
const MARGIN = 16;

const enter = keyframes`
  from {
    opacity: 0;
    transform: translateY(var(--slide)) scale(0.97);
  }
`;

const rise = keyframes`
  from {
    transform: translateY(100%);
  }
`;

const fade = keyframes`
  from {
    opacity: 0;
  }
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  background-color: var(--color-scrim);
  animation: ${fade} var(--duration-base) var(--ease-standard);
`;

const Handle = styled.span`
  display: block;
  width: 2.25rem;
  height: 0.25rem;
  margin: 0 auto var(--space-3);
  background-color: var(--color-fill);
  border-radius: var(--radius-full);
`;

const Calendar = styled.div`
  [data-mode="sheet"] > & {
    max-width: 24rem;
    margin-inline: auto;
  }
`;

const Trigger = styled.button`
  flex: 1;
  min-width: 0;
  padding: 0;
  font: inherit;
  letter-spacing: var(--tracking-tight);
  color: inherit;
  text-align: start;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: transparent;
  border: 0;
  cursor: pointer;

  &[data-empty] {
    color: var(--color-placeholder);
  }

  &:focus-visible {
    outline: none;
  }

  &:disabled {
    cursor: not-allowed;
  }
`;

const Glyph = styled(FieldAdornment)`
  color: var(--color-label-secondary);

  & svg {
    width: 1.1em;
    height: 1.1em;
    fill: currentColor;
  }
`;

const Popover = styled.div`
  position: fixed;
  z-index: var(--z-overlay);
  width: min(20rem, calc(100vw - 2rem));
  padding: var(--space-3);
  background-color: var(--color-bg-grouped-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  corner-shape: squircle;
  box-shadow: var(--shadow-lg);
  transform-origin: var(--origin);
  animation: ${enter} var(--duration-fast) var(--ease-standard);

  &[data-mode="sheet"] {
    inset-inline: 0;
    top: auto;
    bottom: 0;
    z-index: var(--z-modal);
    width: 100%;
    padding: var(--space-3) var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom));
    border-bottom: 0;
    border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
    transform-origin: bottom;
    animation: ${rise} var(--duration-slow) var(--ease-standard);
  }

  &[data-placement="below"] {
    --slide: calc(var(--space-2) * -1);
    --origin: top left;
  }

  &[data-placement="above"] {
    --slide: var(--space-2);
    --origin: bottom left;
  }

  @media (pointer: coarse) {
    width: min(22rem, calc(100vw - 2rem));
  }

  &[data-mode="sheet"] {
    width: 100%;
  }
`;

const Pill = styled.button`
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 2rem;
  padding-inline: var(--space-3) var(--space-2);
  font: inherit;
  font-weight: var(--weight-semibold);
  letter-spacing: var(--tracking-tight);
  color: var(--color-label);
  text-transform: capitalize;
  background-color: var(--color-fill-quaternary);
  border-radius: var(--radius-sm);
  transition: background-color var(--duration-fast) var(--ease-standard);
  --ck-background: var(--color-fill-quaternary);

  &:hover,
  &[aria-expanded="true"] {
    background-color: var(--color-fill-tertiary);
    --ck-background: var(--color-fill-tertiary);
  }

  &:focus-visible {
    outline: 2px solid var(--color-label);
    outline-offset: -2px;
  }

  & svg {
    width: 0.875rem;
    height: 0.875rem;
    color: var(--color-label-secondary);
    fill: currentColor;
  }
`;

const Menu = styled.div`
  position: relative;
  display: inline-flex;
`;

const List = styled.div`
  position: absolute;
  top: calc(100% + var(--space-1));
  inset-inline-start: 0;
  z-index: 1;
  min-width: max(100%, 10rem);
  width: max-content;
  padding: var(--space-1);
  background-color: var(--color-bg-grouped-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
  transform-origin: top left;
  animation: ${enter} var(--duration-fast) var(--ease-standard);
  --slide: calc(var(--space-1) * -1);
`;

const Scroll = styled.ul`
  position: relative;
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
  text-transform: capitalize;
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

type Choice = { value: number; label: string };

function revealOption(list: HTMLElement, option: HTMLElement) {
  const top = option.offsetTop;
  const bottom = top + option.offsetHeight;
  if (top < list.scrollTop) list.scrollTop = top;
  else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
}

type CaptionDropdownProps = {
  label: string;
  options: Choice[];
  value: number;
  onChange: (value: number) => void;
};

function CaptionDropdown({ label, options, value, onChange }: CaptionDropdownProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(value);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) pillRef.current?.focus();
  };

  const choose = (next: number) => {
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
    const selected = document.getElementById(`${listId}-${value}`);
    if (!list || !selected) return;
    list.focus({ preventScroll: true });
    list.scrollTop = selected.offsetTop;
  }, [open, value, listId]);

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const option = document.getElementById(`${listId}-${active}`);
    if (list && option) revealOption(list, option);
  }, [open, active, listId]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    const index = options.findIndex((option) => option.value === active);
    const step = (delta: number) => {
      event.preventDefault();
      const next = options[Math.min(options.length - 1, Math.max(0, index + delta))];
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
    <Menu ref={menuRef}>
      <Pill
        ref={pillRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => {
          setActive(value);
          setOpen((state) => !state);
        }}
        {...squircle("sm")}
      >
        {selected?.label}
        <CaretDownIcon weight="bold" aria-hidden="true" />
      </Pill>
      {open && (
        <List>
          <Scroll
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            aria-activedescendant={`${listId}-${active}`}
            tabIndex={-1}
            onKeyDown={onKeyDown}
          >
            {options.map((option) => (
              <Option
                key={option.value}
                id={`${listId}-${option.value}`}
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

type Components = NonNullable<ComponentProps<typeof DayPicker>["components"]>;
type CaptionProps = ComponentProps<NonNullable<Components["MonthCaption"]>>;

const monthOptions: Choice[] = Array.from({ length: 12 }, (_, month) => ({
  value: month,
  label: format(new Date(2000, month, 1), "LLLL", { locale: ptBR }),
}));

function clamp(date: Date, start: Date, end: Date) {
  if (date < start) return start;
  if (date > end) return end;
  return date;
}

function CalendarCaption({ calendarMonth, displayIndex: _displayIndex, ...props }: CaptionProps) {
  const { goToMonth, dayPickerProps } = useDayPicker();
  const current = calendarMonth.date;
  const start = dayPickerProps.startMonth ?? new Date(1900, 0);
  const end = dayPickerProps.endMonth ?? new Date(current.getFullYear() + 10, 11);
  const yearOptions: Choice[] = Array.from({ length: end.getFullYear() - start.getFullYear() + 1 }, (_, offset) => {
    const year = start.getFullYear() + offset;
    return { value: year, label: String(year) };
  });

  const go = (year: number, month: number) => goToMonth(clamp(new Date(year, month, 1), start, end));

  return (
    <div {...props}>
      <CaptionDropdown
        label="Mês"
        options={monthOptions}
        value={current.getMonth()}
        onChange={(month) => go(current.getFullYear(), month)}
      />
      <CaptionDropdown
        label="Ano"
        options={yearOptions}
        value={current.getFullYear()}
        onChange={(year) => go(year, current.getMonth())}
      />
    </div>
  );
}

const components: Components = { MonthCaption: CalendarCaption };

type Placement = { top: number; left: number; placement: "below" | "above" };

function place(anchor: DOMRect, popover: HTMLElement): Placement {
  const { innerWidth, innerHeight } = window;
  const left = Math.max(MARGIN, Math.min(anchor.left, innerWidth - popover.offsetWidth - MARGIN));
  const below = anchor.bottom + GAP;
  const above = anchor.top - GAP - popover.offsetHeight;
  const fitsBelow = below + popover.offsetHeight <= innerHeight - MARGIN;
  if (fitsBelow || above < MARGIN) return { top: below, left, placement: "below" };
  return { top: above, left, placement: "above" };
}

export function DatePicker({
  id,
  name,
  value,
  defaultValue,
  onChange,
  placeholder = "Selecionar data",
  size = "md",
  invalid = false,
  disabled = false,
  required = false,
  min,
  max,
  iconEnd,
  className,
  style,
  ...aria
}: DatePickerProps) {
  const [inner, setInner] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Placement | null>(null);
  const shellRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const dialogId = useId();

  const sheet = useMediaQuery(MOBILE_QUERY);
  const date = value ?? inner;
  const flagged = invalid || aria["aria-invalid"] === true;

  const select = (next: Date | undefined) => {
    setInner(next);
    onChange?.(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open || sheet) return;
    const update = () => {
      const anchor = shellRef.current?.getBoundingClientRect();
      const popover = popoverRef.current;
      if (anchor && popover) setPosition(place(anchor, popover));
    };
    update();
    popoverRef.current?.querySelector<HTMLElement>('.rdp-day_button[tabindex="0"]')?.focus();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, sheet]);

  useEffect(() => {
    if (!open || !sheet) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    popoverRef.current?.querySelector<HTMLElement>('.rdp-day_button[tabindex="0"]')?.focus({ preventScroll: true });
    return () => {
      root.style.overflow = previous;
    };
  }, [open, sheet]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (shellRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const currentYear = new Date().getFullYear();

  return (
    <FieldShell ref={shellRef} size={size} invalid={flagged} className={className} style={style}>
      <Trigger
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        data-empty={date ? undefined : ""}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-required={required || undefined}
        aria-invalid={flagged || undefined}
        aria-describedby={aria["aria-describedby"]}
        onClick={() => setOpen((state) => !state)}
      >
        {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : placeholder}
      </Trigger>
      {iconEnd && <FieldAdornment>{iconEnd}</FieldAdornment>}
      <Glyph aria-hidden="true">
        <CalendarBlankIcon />
      </Glyph>
      {name && <input type="hidden" name={name} value={date ? format(date, "yyyy-MM-dd") : ""} readOnly />}
      {open &&
        createPortal(
          <>
            {sheet && <Backdrop onClick={() => setOpen(false)} />}
            <Popover
              ref={popoverRef}
              id={dialogId}
              role="dialog"
              aria-modal={sheet || undefined}
              aria-label="Escolher data"
              data-mode={sheet ? "sheet" : "floating"}
              data-placement={sheet ? undefined : (position?.placement ?? "below")}
              style={
                sheet ? undefined : position ? { top: position.top, left: position.left } : { visibility: "hidden" }
              }
            >
              {sheet && <Handle aria-hidden="true" />}
              <Calendar>
                <DayPicker
                  mode="single"
                  locale={ptBR}
                  selected={date}
                  onSelect={select}
                  defaultMonth={date}
                  components={components}
                  startMonth={min ?? new Date(1900, 0)}
                  endMonth={max ?? new Date(currentYear + 10, 11)}
                  disabled={[...(min ? [{ before: min }] : []), ...(max ? [{ after: max }] : [])]}
                  showOutsideDays
                />
              </Calendar>
            </Popover>
          </>,
          document.body,
        )}
    </FieldShell>
  );
}
