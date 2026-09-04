"use client";

import styled from "@emotion/styled";
import { DotsSixVerticalIcon } from "@phosphor-icons/react";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Listbox, type ListboxOption } from "@/components/ui/listbox";
import { focusRing } from "@/components/ui/styles";
import { applyTheme, type ThemePreference } from "@/lib/theme";

type ThemeToggleProps = {
  initial: ThemePreference;
  floating?: boolean;
};

type Offset = { x: number; y: number };

const options: ListboxOption<ThemePreference>[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
];

const KEY_STEP = 16;

const Dock = styled.div`
  position: fixed;
  inset-block-end: var(--space-4);
  inset-inline-start: var(--space-4);
  /* Acima da camada do modal: em homologação a troca de tema precisa alcançar os primeiros passos. */
  z-index: var(--z-toast);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1);
  background-color: var(--color-bg-grouped-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
`;

const Grip = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 2rem;
  padding: 0;
  color: var(--color-label-tertiary);
  background: transparent;
  border: 0;
  border-radius: var(--radius-xs);
  cursor: grab;
  touch-action: none;

  ${focusRing};

  &:active {
    cursor: grabbing;
  }

  & svg {
    width: 1rem;
    height: 1rem;
    fill: currentColor;
  }
`;

export function ThemeToggle({ initial, floating = true }: ThemeToggleProps) {
  const [preference, setPreference] = useState<ThemePreference>(initial);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const dockRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: Offset; base: Offset } | null>(null);

  const change = (next: ThemePreference) => {
    setPreference(next);
    applyTheme(next);
  };

  const clamp = (next: Offset): Offset => {
    const dock = dockRef.current;
    if (!dock) return next;
    const rect = dock.getBoundingClientRect();
    const restLeft = rect.left - offset.x;
    const restTop = rect.top - offset.y;
    return {
      x: Math.min(Math.max(next.x, -restLeft), window.innerWidth - rect.width - restLeft),
      y: Math.min(Math.max(next.y, -restTop), window.innerHeight - rect.height - restTop),
    };
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: { x: event.clientX, y: event.clientY }, base: offset };
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current) return;
    setOffset(
      clamp({
        x: current.base.x + event.clientX - current.pointer.x,
        y: current.base.y + event.clientY - current.pointer.y,
      }),
    );
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const moves: Record<string, Offset> = {
      ArrowLeft: { x: -KEY_STEP, y: 0 },
      ArrowRight: { x: KEY_STEP, y: 0 },
      ArrowUp: { x: 0, y: -KEY_STEP },
      ArrowDown: { x: 0, y: KEY_STEP },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setOffset(clamp({ x: offset.x + move.x, y: offset.y + move.y }));
  };

  const control = (
    <Listbox label="Tema" prefix="Tema" placement="above" options={options} value={preference} onChange={change} />
  );

  if (!floating) return control;

  return (
    <Dock ref={dockRef} style={{ translate: `${offset.x}px ${offset.y}px` }}>
      <Grip
        type="button"
        aria-label="Arrastar seletor de tema"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <DotsSixVerticalIcon weight="bold" />
      </Grip>
      {control}
    </Dock>
  );
}
