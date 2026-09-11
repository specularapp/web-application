"use client";

import styled from "@emotion/styled";
import { CaretDownIcon, CaretUpIcon, TimerIcon } from "@phosphor-icons/react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { Dialog } from "../dialog";
import { FieldAdornment, FieldShell } from "../field-shell";
import { IconButton } from "../icon-button";
import { popIn, type ControlSize } from "../styles";
import { Text } from "../text";

export type DurationPickerProps = {
  id?: string;
  name?: string;
  /** O total, em minutos. */
  value?: number;
  onChange?: (minutes: number) => void;
/** Quantas horas tem um dia, o que dá o teto da coluna de horas e converte a de dias em minutos. */
  hoursPerDay?: number;
  /** O teto da coluna de dias. */
  maxDays?: number;
  /** De quanto em quanto a coluna de minutos anda. */
  minuteStep?: number;
  /** Como o total escolhido é escrito no gatilho; sem isto, "2 d 3 h 30 min". */
  display?: (minutes: number) => string;
  placeholder?: string;
  size?: ControlSize;
  disabled?: boolean;
  /** Sem a moldura de campo e sem o glifo: sobra o valor como texto, e o clique nele abre a roleta. */
  plain?: boolean;
  /** O nome da caixa para leitor de tela. */
  label?: string;
  className?: string;
  style?: CSSProperties;
};

const GAP = 8;
const MARGIN = 16;
/* A altura de uma linha da roleta, em pixels: a rolagem encaixa de linha em linha, e a conta de qual valor
   está no meio é `scrollTop / ROW`, então ela precisa ser um número, e não um token. */
const ROW = 36;

const columns = ["days", "hours", "minutes"] as const;
type Column = (typeof columns)[number];

const names: Record<Column, string> = { days: "Dias", hours: "Horas", minutes: "Minutos" };

/* O total escrito só com as partes que existem: "3 h 30 min", e não "0 d 3 h 30 min". Zero é "Sem
   estimativa", porque um campo vazio não diz "0 min". */
function write(minutes: number, hoursPerDay: number) {
  if (minutes <= 0) return "Sem estimativa";
  const perDay = hoursPerDay * 60;
  const parts = [
    [Math.floor(minutes / perDay), "d"],
    [Math.floor((minutes % perDay) / 60), "h"],
    [minutes % 60, "min"],
  ] as const;
  return parts
    .filter(([amount]) => amount > 0)
    .map(([amount, unit]) => `${amount} ${unit}`)
    .join(" ");
}

const split = (minutes: number, hoursPerDay: number) => {
  const perDay = hoursPerDay * 60;
  return {
    days: Math.floor(minutes / perDay),
    hours: Math.floor((minutes % perDay) / 60),
    minutes: minutes % 60,
  };
};

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

/**
 * Uma coluna da roleta: a seta de subir, a fila de valores que rola encaixando de linha em linha, e a seta de
 * descer. A fila leva uma linha em branco em cima e outra embaixo, pelo recuo, para o primeiro e o último
 * valor conseguirem parar no meio, que é onde a faixa da escolha está.
 */
function Wheel({
  column,
  value,
  values,
  onPick,
}: {
  column: Column;
  value: number;
  values: number[];
  onPick: (next: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const settling = useRef<number | null>(null);
  const name = names[column];
  const index = Math.max(0, values.indexOf(value));

  /* O valor manda na posição: mudou por fora (seta, outra coluna, outra tarefa), a fila vai para ele. */
  useLayoutEffect(() => {
    const list = track.current;
    if (!list) return;
    const top = index * ROW;
    if (Math.abs(list.scrollTop - top) > 2) list.scrollTo({ top, behavior: "auto" });
  }, [index]);

  /* Rolando, quem está no meio é quem vale. A conta espera a rolagem parar, senão cada quadro da inércia
     viraria uma escolha. */
  const onScroll = () => {
    const list = track.current;
    if (!list) return;
    if (settling.current !== null) window.clearTimeout(settling.current);
    settling.current = window.setTimeout(() => {
      const next = values[Math.max(0, Math.min(values.length - 1, Math.round(list.scrollTop / ROW)))];
      if (next !== undefined && next !== value) onPick(next);
    }, 90);
  };

  const step = (direction: 1 | -1) => {
    const next = values[Math.max(0, Math.min(values.length - 1, index + direction))];
    if (next !== undefined) onPick(next);
  };

  return (
    <Column role="group" aria-label={name}>
      <Text as="span" variant="caption2" tone="tertiary" weight="medium">
        {name}
      </Text>
      <Arrow>
        <IconButton label={`Mais ${name.toLowerCase()}`} variant="ghost" size="sm" disabled={index === values.length - 1} onClick={() => step(1)}>
          <CaretUpIcon />
        </IconButton>
      </Arrow>
      <Lane>
        <Track ref={track} onScroll={onScroll} tabIndex={0} role="listbox" aria-label={name} aria-activedescendant={`${column}-${value}`}>
          {values.map((option) => (
            <Option
              key={option}
              id={`${column}-${option}`}
              type="button"
              role="option"
              aria-selected={option === value}
              data-on={option === value || undefined}
              onClick={() => onPick(option)}
            >
              {option}
            </Option>
          ))}
        </Track>
      </Lane>
      <Arrow>
        <IconButton label={`Menos ${name.toLowerCase()}`} variant="ghost" size="sm" disabled={index === 0} onClick={() => step(-1)}>
          <CaretDownIcon />
        </IconButton>
      </Arrow>
    </Column>
  );
}

// A estimativa como três roletas, dias, horas e minutos (2026-09-10, a pedido, sobre uma referência de
// seletor de data em roletas): a fila rola encaixando de linha em linha, o valor do meio é o escolhido e as
// setas andam de um em um. O total vai para fora em minutos, que é como a tarefa guarda, e o gatilho mostra
// só as partes que existem. Na moldura e na receita do `DatePicker`: campo ou valor cru, caixa flutuante no
// computador e bandeja no celular.
export function DurationPicker({
  id,
  name,
  value = 0,
  onChange,
  hoursPerDay = 24,
  maxDays = 60,
  minuteStep = 1,
  display,
  placeholder = "Sem estimativa",
  size = "md",
  disabled = false,
  plain = false,
  label = "Escolher a estimativa",
  className,
  style,
}: DurationPickerProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Placement | null>(null);
  const shellRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const dialogId = useId();
  const sheet = useMediaQuery(MOBILE_QUERY);

  const parts = split(value, hoursPerDay);
  const options: Record<Column, number[]> = {
    days: Array.from({ length: maxDays + 1 }, (_, day) => day),
    hours: Array.from({ length: hoursPerDay }, (_, hour) => hour),
    minutes: Array.from({ length: Math.ceil(60 / minuteStep) }, (_, slot) => slot * minuteStep),
  };

  const pick = (column: Column, next: number) => {
    const merged = { ...parts, [column]: next };
    onChange?.(merged.days * hoursPerDay * 60 + merged.hours * 60 + merged.minutes);
  };

  useLayoutEffect(() => {
    if (!open || sheet) return;
    const update = () => {
      const anchor = shellRef.current?.getBoundingClientRect();
      const popover = popoverRef.current;
      if (anchor && popover) setPosition(place(anchor, popover));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, sheet]);

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

  const wheels = (
    <Wheels>
      {columns.map((column) => (
        <Wheel key={column} column={column} value={parts[column]} values={options[column]} onPick={(next) => pick(column, next)} />
      ))}
    </Wheels>
  );

  const Shell = plain ? PlainShell : FieldShell;
  const shellProps = plain ? {} : { size };

  return (
    <Shell ref={shellRef} {...shellProps} className={className} style={style}>
      <Trigger
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        data-empty={value > 0 ? undefined : ""}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        {value > 0 ? (display ? display(value) : write(value, hoursPerDay)) : placeholder}
      </Trigger>
      {!plain && (
        <Glyph aria-hidden="true">
          <TimerIcon />
        </Glyph>
      )}
      {name && <input type="hidden" name={name} value={value} readOnly />}
      {open && sheet && (
        <Dialog open={open} onClose={() => setOpen(false)} label={label} surface="glass" scrim={false} focusOnOpen={false}>
          <SheetBody ref={popoverRef} id={dialogId}>
            {wheels}
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
            aria-label={label}
            data-placement={position?.placement ?? "below"}
            style={position ? { top: position.top, left: position.left } : { visibility: "hidden" }}
          >
            {wheels}
          </Popover>,
          document.body,
        )}
    </Shell>
  );
}

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

const PlainShell = styled.span`
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
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
  padding: var(--space-3);
  background-color: var(--glass-sheet-bg);
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
`;

const SheetBody = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-2) var(--space-4) var(--space-4);

  html[data-floating-actions] & {
    padding-block-end: var(--floating-bar-inset);
  }
`;

/** As três colunas lado a lado: dias, horas e minutos, cada uma com a própria fila. */
const Wheels = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(3.25rem, 1fr));
  gap: var(--space-2);
  min-width: 0;
`;

/**
 * A pista de uma coluna, com a faixa da escolha na linha do meio: é ela que diz qual valor vale. Fica aqui, e
 * não no bloco das três, porque é a esta caixa que a linha do meio pertence, e a conta da posição é a mesma
 * do encaixe da rolagem.
 */
const Lane = styled.div`
  position: relative;
  width: 100%;

  &::before {
    position: absolute;
    top: ${ROW}px;
    right: 0;
    left: 0;
    height: ${ROW}px;
    pointer-events: none;
    content: "";
    background-color: var(--color-fill-quaternary);
    border-radius: var(--radius-md);
    corner-shape: squircle;
  }
`;

const Column = styled.div`
  display: grid;
  gap: var(--space-half);
  justify-items: center;
  min-width: 0;
`;

const Arrow = styled.div`
  --control-height-sm: 2rem;
  --icon-button-radius-sm: var(--radius-sm);
  --touch-target: 2rem;

  display: grid;
  place-items: center;

  & svg {
    width: 1rem;
    height: 1rem;
  }

  /* No dedo, o alvo é o da casa. */
  @media (pointer: coarse) {
    --control-height-sm: var(--touch-target-min, 2.75rem);
    --touch-target: 2.75rem;
  }
`;

/* A fila que rola: três linhas de altura, encaixando de linha em linha, com uma linha em branco em cima e
   embaixo para as pontas alcançarem o meio. A barra de rolagem sai, porque a faixa já diz onde se está. */
const Track = styled.div`
  display: grid;
  width: 100%;
  height: ${ROW * 3}px;
  padding-block: ${ROW}px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    width: 0;
  }

  @media (hover: hover) {
    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
      border-radius: var(--radius-sm);
    }
  }
`;

const Option = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  height: ${ROW}px;
  padding: 0;
  font-family: var(--font-body);
  font-size: var(--text-subheadline);
  font-weight: var(--weight-medium);
  font-variant-numeric: tabular-nums;
  letter-spacing: var(--tracking-tight);
  color: var(--color-label-tertiary);
  cursor: pointer;
  background: none;
  border: 0;
  scroll-snap-align: center;
  transition: color var(--duration-fast) var(--ease-standard);

  /* Quem está na faixa fica na tinta cheia e em negrito: é o único sinal de escolha que a roleta precisa. */
  &[data-on] {
    font-weight: var(--weight-semibold);
    color: var(--color-label);
  }

  @media (hover: hover) {
    &:hover {
      color: var(--color-label-secondary);
    }

    &:focus-visible {
      outline: none;
    }
  }
`;

