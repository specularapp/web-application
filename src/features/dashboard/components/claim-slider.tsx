"use client";

import styled from "@emotion/styled";
import { CaretDoubleRightIcon, CheckIcon } from "@phosphor-icons/react";
import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
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
   bolinha que anda por cima. Tudo em preto e branco, limpo: a bolinha é a cor do texto (preta no claro,
   branca no escuro) com a seta na cor do fundo, e o preenchimento é a cor do texto em alfa baixo. */
const Track = styled.div`
  --x: 0px;
  --progress: 0;
  --claim-hue: var(--color-label);
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

/* O preenchimento que acompanha a bolinha: a cor do texto num degradê de alfa, mais claro no começo e
   mais cheio no fim, pintado na pista inteira e revelado até a borda direita da bolinha por um recorte,
   e não por largura, então o arrasto vai descobrindo o degradê parado. Solto no meio do caminho, volta
   com a mesma mola. Pego, aparece inteiro. (O degradê de várias cores durou uma rodada.) */
const Fill = styled.span`
  --reveal: calc(var(--x) + ${KNOB + INSET * 2}px);
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    color-mix(in oklab, var(--claim-hue) 6%, transparent),
    color-mix(in oklab, var(--claim-hue) 18%, transparent)
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

/* A bolinha na cor do texto com a seta dupla na cor do fundo, que vira check ao chegar. Enquanto se arrasta ela segue o
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
  color: var(--color-bg);
  cursor: grab;
  background-color: var(--claim-hue);
  border: 0;
  border-radius: var(--radius-full);
  /* O dedo na bolinha é sempre arrasto: sem isto o navegador segura os primeiros eventos para decidir
     se a intenção era rolar a página, e o começo do gesto saía engasgado no celular. A pista segue
     aceitando rolagem vertical, então arrastar a página tocando fora da bolinha continua funcionando. */
  touch-action: none;
  translate: var(--x) 0;
  transition: translate var(--duration-base) var(--ease-spring);
  ${focusRing};

  &[data-dragging] {
    cursor: grabbing;
    transition: none;
    /* Camada própria enquanto anda, para o navegador só recompor em vez de repintar a cada quadro. */
    will-change: translate;
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

/* A posição vai direto para as variáveis do nó, e não para estado do React (acerto de fluidez de
   2026-09-08): o ponteiro dispara bem mais de sessenta eventos por segundo, e um `setState` por evento
   remontava a pista, o preenchimento, o rótulo e a bolinha a cada um deles, o que segurava o arrasto. */
function paint(track: HTMLDivElement, x: number, max: number) {
  track.style.setProperty("--x", `${x}px`);
  track.style.setProperty("--progress", String(max > 0 ? x / max : 0));
}

// Arraste a bolinha até o fim para ganhar os pontos do dia. Com o mouse ou o dedo, a bolinha segue o
// ponteiro e a pista vai se preenchendo atrás dela; soltar antes de 85% volta ao começo, preenchimento
// junto, e passar disso completa e trava. No teclado, Enter,
// Espaço ou a seta para o fim completam direto. Vale uma vez por dia: pego, o controle fica travado no
// fim com o check até o dia seguinte.
export function ClaimSlider({ points, claimed = false, onClaim }: ClaimSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; max: number; x: number; frame: number } | null>(null);
  const [done, setDone] = useState(claimed);
  const [dragging, setDragging] = useState(false);

  const claim = () => {
    setDone(true);
    setDragging(false);
    onClaim?.();
  };

  const start = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (done) return;
    const track = trackRef.current;
    if (!track) return;
    drag.current = { startX: event.clientX, max: track.clientWidth - KNOB - INSET * 2, x: 0, frame: 0 };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  // Uma escrita por quadro: o evento só guarda a posição, e o quadro seguinte pinta a última que chegou.
  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    const track = trackRef.current;
    if (!state || !track) return;
    state.x = Math.min(state.max, Math.max(0, event.clientX - state.startX));
    if (state.frame) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      paint(track, state.x, state.max);
    });
  };

  const end = () => {
    const state = drag.current;
    const track = trackRef.current;
    if (!state || !track) return;
    if (state.frame) cancelAnimationFrame(state.frame);
    drag.current = null;

    if (state.max > 0 && state.x / state.max >= CLAIM_AT) {
      paint(track, state.max, state.max);
      claim();
      return;
    }

    setDragging(false);
    // A volta é pintada no quadro seguinte, depois de o React tirar o `data-dragging`: escrevendo agora,
    // a transição ainda estaria desligada e a bolinha saltaria para o começo em vez de voltar com a mola.
    requestAnimationFrame(() => paint(track, 0, state.max));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (done) return;
    if (event.key === "Enter" || event.key === " " || event.key === "End" || event.key === "ArrowRight") {
      event.preventDefault();
      claim();
    }
  };

  return (
    <Track ref={trackRef} data-claimed={done || undefined} data-dragging={dragging || undefined}>
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
