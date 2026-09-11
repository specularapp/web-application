"use client";

import styled from "@emotion/styled";
import { CalendarBlankIcon } from "@phosphor-icons/react";
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
  type ReactNode,
} from "react";
import { DayPicker, useDayPicker } from "react-day-picker";
import { createPortal } from "react-dom";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { Dialog } from "../dialog";
import { FieldAdornment, FieldShell } from "../field-shell";
import { Listbox, type ListboxOption } from "../listbox";
import { popIn, type ControlSize } from "../styles";

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
  /**
   * Sem a moldura de campo e sem o glifo do calendário: sobra a data como texto, e o clique nela abre o
   * calendário (2026-09-10, das informações da tarefa). É o mesmo motivo do gatilho sem caixa do
   * `DropdownMenu`: numa ficha, o valor tem de continuar parecendo valor, e não formulário.
   */
  plain?: boolean;
  /**
   * Como a data escolhida é escrita, no padrão do `date-fns`. O campo mostra `dd/MM/yyyy`, que é o formato
   * de digitar; sem moldura, quem lê a data está lendo um valor de ficha, e ali "domingo, 13 de set." diz
   * mais que os números (2026-09-10). O que vai para o formulário, no campo escondido, é sempre ISO.
   */
  display?: string;
  className?: string;
  style?: CSSProperties;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

const GAP = 8;
const MARGIN = 16;

/* No celular o calendário mora na bandeja do `Dialog` (acerto de 2026-09-10): a bandeja própria que existia
   aqui nascia na camada da janela, abaixo do próprio fundo escuro, que estava na camada das caixas
   flutuantes, e a pessoa via o calendário apagado atrás de um véu, sem conseguir tocar. Na bandeja da casa
   entram de graça o fundo, a alça, o arrasto para fechar, a fila de camadas e a folga da barra flutuante
   embaixo, o mesmo respiro de toda bandeja. O calendário fica centrado, na largura em que ele desenha bem. */
const SheetBody = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 0;
  padding: var(--space-2) var(--space-4) var(--space-4);
  overflow-y: auto;
  overscroll-behavior: contain;

  html[data-floating-actions] & {
    padding-block-end: var(--floating-bar-inset);
  }

  & > * {
    width: 100%;
    max-width: 24rem;
  }
`;

const Calendar = styled.div``;

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

  @media (hover: hover) {
    &:focus-visible {
      outline: none;
    }
  }

  &:disabled {
    cursor: not-allowed;
  }
`;

/* O invólucro sem moldura: só o lugar de onde o calendário se posiciona. O texto herda a tipografia de quem
   o contém, então a data lê como o resto da linha em vez de como campo. */
const PlainShell = styled.span`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  max-width: 100%;
  color: inherit;
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
  z-index: var(--z-popover);
  width: min(20rem, calc(100vw - 2rem));
  padding: var(--space-3);
  /* Vidro da casa, como o painel do listbox e as camadas do menu (pedido de 2026-09-09). Na bandeja do
     celular o vidro é o da bandeja, mais corpo, porque ali o conteúdo da página passa perto do texto.
     Os seletores de mês e ano abrem por cima deste vidro, então eles recebem a superfície da bandeja: vidro
     a 20% sobre vidro a 20% ficava quase invisível. */
  --listbox-panel-bg: var(--glass-sheet-bg);

  background-color: var(--glass-layer-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  corner-shape: squircle;
  box-shadow: var(--shadow-lg);
  -webkit-backdrop-filter: var(--glass-layer-blur);
  backdrop-filter: var(--glass-layer-blur);
  transform-origin: var(--origin);
  animation: ${popIn} var(--duration-fast) var(--ease-standard);

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
`;

type Components = NonNullable<ComponentProps<typeof DayPicker>["components"]>;
type CaptionProps = ComponentProps<NonNullable<Components["MonthCaption"]>>;

function capitalize(text: string) {
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
}

const monthOptions: ListboxOption<number>[] = Array.from({ length: 12 }, (_, month) => ({
  value: month,
  label: capitalize(format(new Date(2000, month, 1), "LLLL", { locale: ptBR })),
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
  const yearOptions: ListboxOption<number>[] = Array.from({ length: end.getFullYear() - start.getFullYear() + 1 }, (_, offset) => {
    const year = start.getFullYear() + offset;
    return { value: year, label: String(year) };
  });

  const go = (year: number, month: number) => goToMonth(clamp(new Date(year, month, 1), start, end));

  return (
    <div {...props}>
      <Listbox
        label="Mês"
        options={monthOptions}
        value={current.getMonth()}
        onChange={(month) => go(current.getFullYear(), month)}
      />
      <Listbox
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
  plain = false,
  display = "dd/MM/yyyy",
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
    popoverRef.current?.querySelector<HTMLElement>('.rdp-day_button[tabindex="0"]')?.focus({ preventScroll: true });
  }, [open, sheet]);

  // Flutuando, quem fecha ao toque fora e ao Escape é o próprio calendário; na bandeja é o `Dialog`, que
  // também sabe se é a camada de cima (os seletores de mês e ano abrem outra bandeja por cima dela).
  useEffect(() => {
    if (!open || sheet) return;
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
  }, [open, sheet]);

  const currentYear = new Date().getFullYear();

  /* O calendário em si, o mesmo na caixa flutuante e na bandeja. */
  const calendar = (
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
  );

  /* Sem moldura, o invólucro é só o lugar de onde o calendário se posiciona, e o glifo do campo sai: sobra a
     data como texto. Com moldura, é o `FieldShell` de sempre. */
  const Shell = plain ? PlainShell : FieldShell;
  const shellProps = plain ? {} : { size, invalid: flagged };

  return (
    <Shell ref={shellRef} {...shellProps} className={className} style={style}>
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
        {date ? format(date, display, { locale: ptBR }) : placeholder}
      </Trigger>
      {iconEnd && <FieldAdornment>{iconEnd}</FieldAdornment>}
      {!plain && (
        <Glyph aria-hidden="true">
          <CalendarBlankIcon />
        </Glyph>
      )}
      {name && <input type="hidden" name={name} value={date ? format(date, "yyyy-MM-dd") : ""} readOnly />}
      {open && sheet && (
        <Dialog open={open} onClose={() => setOpen(false)} label="Escolher data" surface="glass" scrim={false} focusOnOpen={false}>
          <SheetBody ref={popoverRef} id={dialogId}>
            <Calendar>{calendar}</Calendar>
          </SheetBody>
        </Dialog>
      )}
      {open &&
        !sheet &&
        createPortal(
          <Popover
            ref={popoverRef}
            id={dialogId}
            role="dialog"
            aria-label="Escolher data"
            data-mode="floating"
            data-placement={position?.placement ?? "below"}
            style={position ? { top: position.top, left: position.left } : { visibility: "hidden" }}
          >
            <Calendar>{calendar}</Calendar>
          </Popover>,
          document.body,
        )}
    </Shell>
  );
}
