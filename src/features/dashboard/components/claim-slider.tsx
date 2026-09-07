"use client";

import styled from "@emotion/styled";
import { CaretDoubleRightIcon, CheckIcon } from "@phosphor-icons/react";
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { focusRing } from "@/components/ui/styles";

export type ClaimSliderProps = {
  /** Quantos pontos o arrasto vale. */
  points: number;
  /** Se o bônus de hoje já foi pego: o controle nasce travado no fim. */
  claimed?: boolean;
  /** Chamado uma vez, quando o arrasto chega ao fim. */
  onClaim?: () => void;
};

const KNOB = 36;
const INSET = 4;
const CLAIM_AT = 0.85;

/* A pista: uma pílula no preenchimento da casa, da altura do controle médio, com o texto centrado e a
   bolinha que anda por cima. A cor do arrasto é o roxo do painel, a cor de dado da casa, a mesma da barra
   do desafio: bolinha cheia, preenchimento em alfa. */
const Track = styled.div`
  --x: 0px;
  --progress: 0;
  --claim-hue: var(--sys-purple);
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  height: var(--control-height-md);
  overflow: hidden;
  color: var(--gamification-ink);
  user-select: none;
  touch-action: pan-y;
  background-color: var(--gamification-pill);
  border-radius: var(--radius-full);

`;

/* O preenchimento que acompanha a bolinha: um degradê de várias cores da paleta (roxo, índigo, azul,
   rosa e laranja) pintado na pista inteira e revelado até a borda direita da bolinha por um recorte, e
   não por largura, então as cores ficam paradas e o arrasto vai descobrindo uma a uma. Solto no meio do
   caminho, volta com a mesma mola. Pego, aparece inteiro. */
const Fill = styled.span`
  --reveal: calc(var(--x) + ${KNOB + INSET * 2}px);
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    color-mix(in oklab, var(--sys-purple) 45%, transparent),
    color-mix(in oklab, var(--sys-indigo) 45%, transparent) 30%,
    color-mix(in oklab, var(--sys-blue) 45%, transparent) 55%,
    color-mix(in oklab, var(--sys-pink) 45%, transparent) 80%,
    color-mix(in oklab, var(--sys-orange) 50%, transparent)
  );
  border-radius: var(--radius-full);
  clip-path: inset(0 calc(100% - var(--reveal)) 0 0 round var(--radius-full));
  transition: clip-path var(--duration-base) var(--ease-spring);

  [data-dragging] > & {
    transition: none;
  }

  [data-claimed] > & {
    clip-path: inset(0 round var(--radius-full));
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/* O texto apaga conforme a bolinha avança, para o arrasto ler como progresso. */
const Label = styled.span`
  padding-inline: calc(${KNOB}px + var(--space-3)) var(--space-3);
  font-family: var(--font-body);
  font-size: var(--text-subheadline);
  font-weight: var(--weight-semibold);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-tight);
  white-space: nowrap;
  opacity: calc(1 - var(--progress) * 1.4);
  transition: opacity var(--duration-fast) var(--ease-standard);

  [data-claimed] > & {
    padding-inline: var(--space-3) calc(${KNOB}px + var(--space-3));
    opacity: 1;
  }

  position: relative;
`;

/* A bolinha no roxo cheio com a seta dupla em branco, que vira check ao chegar. Enquanto se arrasta ela segue o
   ponteiro sem transição; ao soltar, volta ou completa com a mola curta da casa. */
const Knob = styled.button`
  position: absolute;
  inset-block-start: ${INSET}px;
  inset-inline-start: ${INSET}px;
  display: grid;
  place-items: center;
  width: ${KNOB}px;
  height: ${KNOB}px;
  padding: 0;
  color: var(--color-on-accent);
  cursor: grab;
  background-color: var(--claim-hue);
  border: 0;
  border-radius: var(--radius-full);
  translate: var(--x) 0;
  transition: translate var(--duration-base) var(--ease-spring);
  ${focusRing};

  &[data-dragging] {
    cursor: grabbing;
    transition: none;
  }

  /* Pego, a bolinha assenta no fim pela borda direita, sem medir nada. */
  [data-claimed] > & {
    inset-inline-start: auto;
    inset-inline-end: ${INSET}px;
    cursor: default;
    translate: 0 0;
  }

  & svg {
    width: 1rem;
    height: 1rem;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

// Arraste a bolinha até o fim para ganhar os pontos do dia. Com o mouse ou o dedo, a bolinha segue o
// ponteiro e a pista vai se preenchendo atrás dela; soltar antes de 85% volta ao começo, preenchimento
// junto, e passar disso completa e trava. No teclado, Enter,
// Espaço ou a seta para o fim completam direto. Vale uma vez por dia: pego, o controle fica travado no
// fim com o check até o dia seguinte.
export function ClaimSlider({ points, claimed = false, onClaim }: ClaimSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; max: number } | null>(null);
  const [done, setDone] = useState(claimed);
  const [x, setX] = useState(0);
  const [max, setMax] = useState(0);
  const [dragging, setDragging] = useState(false);

  const claim = () => {
    setDone(true);
    setDragging(false);
    onClaim?.();
  };

  const start = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (done) return;
    const track = trackRef.current;
    const reach = track ? track.clientWidth - KNOB - INSET * 2 : 0;
    drag.current = { startX: event.clientX, max: reach };
    setMax(reach);
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    setX(Math.min(drag.current.max, Math.max(0, event.clientX - drag.current.startX)));
  };

  const end = () => {
    if (!drag.current) return;
    const { max } = drag.current;
    drag.current = null;
    if (max > 0 && x / max >= CLAIM_AT) {
      claim();
      return;
    }
    setDragging(false);
    setX(0);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (done) return;
    if (event.key === "Enter" || event.key === " " || event.key === "End" || event.key === "ArrowRight") {
      event.preventDefault();
      claim();
    }
  };

  const progress = done ? 1 : max > 0 ? x / max : 0;
  const vars = { "--x": `${x}px`, "--progress": progress } as CSSProperties;

  return (
    <Track ref={trackRef} data-claimed={done || undefined} data-dragging={dragging || undefined} style={vars}>
      <Fill aria-hidden="true" />
      <Label aria-hidden="true">{done ? `${points} pontos ganhos hoje` : `Arraste para ganhar ${points} pontos`}</Label>
      <Knob
        type="button"
        aria-label={done ? `Bônus de ${points} pontos já pego hoje. Volte amanhã.` : `Arraste até o fim para ganhar ${points} pontos hoje`}
        disabled={done}
        data-dragging={dragging || undefined}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={onKeyDown}
      >
        {done ? <CheckIcon weight="bold" /> : <CaretDoubleRightIcon weight="bold" />}
      </Knob>
    </Track>
  );
}
