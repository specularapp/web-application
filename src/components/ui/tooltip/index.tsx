"use client";

import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";
import { cloneElement, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";

type TriggerProps = { "aria-describedby"?: string };

export type TooltipProps = {
  content: ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "end" | "center";
  open?: boolean;
  className?: string;
  children: ReactElement<TriggerProps>;
};

/** A folga entre o gatilho e o balão, a margem até a borda da janela e onde a seta cai no balão alinhado
 *  pela ponta (o raio do canto mais meia seta), em pixels. */
const OFFSET = 10;
const EDGE = 8;
const ARROW_INSET = 16;

const enter = keyframes`
  from {
    opacity: 0;
    transform: translateY(var(--slide)) scale(0.95);
  }
`;

const Root = styled.span`
  display: inline-flex;
  align-items: center;
`;

/* O balão é portado para o corpo da página e fixo na tela (acerto de 2026-09-15: absoluto dentro do gatilho,
   qualquer painel com rolagem ou janela com `overflow: hidden` o recortava). A posição entra por estilo
   inline, medida no `useLayoutEffect` antes de pintar; até medir ele fica invisível. */
const Bubble = styled.span`
  --bubble-radius: var(--radius-md);
  --arrow-size: 0.625rem;

  position: fixed;
  z-index: var(--z-popover);
  width: max-content;
  max-width: 18rem;
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-code);
  font-size: var(--text-footnote);
  font-weight: var(--weight-medium);
  line-height: var(--leading-normal);
  letter-spacing: var(--tracking-normal);
  color: var(--color-bg);
  text-align: start;
  text-wrap: pretty;
  background-color: var(--color-label);
  border-radius: var(--bubble-radius);
  corner-shape: squircle;
  pointer-events: none;
  transform-origin: var(--arrow-x) var(--origin-y);
  animation: ${enter} var(--duration-fast) var(--ease-standard);

  &[data-side="top"] {
    --slide: var(--space-2);
    --origin-y: 100%;
  }

  &[data-side="bottom"] {
    --slide: calc(var(--space-2) * -1);
    --origin-y: 0;
  }

  &[data-measuring] {
    visibility: hidden;
    animation: none;
  }
`;

const Arrow = styled.span`
  position: absolute;
  left: var(--arrow-x);
  width: var(--arrow-size);
  height: var(--arrow-size);
  background-color: var(--color-label);
  border-radius: calc(var(--radius-xs) / 2);
  translate: -50% 0;
  rotate: 45deg;

  [data-side="top"] > & {
    bottom: calc(var(--arrow-size) / -2 + var(--space-half));
  }

  [data-side="bottom"] > & {
    top: calc(var(--arrow-size) / -2 + var(--space-half));
  }
`;

export function Tooltip({ content, side = "top", align = "center", open, className, children }: TooltipProps) {
  const [hovered, setHovered] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const bubbleId = useId();
  const visible = open ?? hovered;

  /* Mede o gatilho e o balão e escreve a posição direto no elemento: sem estado, para não repintar, e sem
     salto, porque acontece antes do primeiro quadro. Vira para o outro lado quando não cabe, e a seta segue
     o centro do gatilho mesmo com o balão encostado na borda da janela. */
  useLayoutEffect(() => {
    if (!visible) return;
    const place = () => {
      const anchor = rootRef.current?.getBoundingClientRect();
      const bubble = bubbleRef.current;
      const box = bubble?.getBoundingClientRect();
      if (!anchor || !bubble || !box) return;
      const centerX = anchor.left + anchor.width / 2;
      const wanted = align === "start" ? centerX - ARROW_INSET : align === "end" ? centerX - box.width + ARROW_INSET : centerX - box.width / 2;
      const left = Math.min(Math.max(EDGE, wanted), Math.max(EDGE, window.innerWidth - box.width - EDGE));
      const fitsAbove = anchor.top - OFFSET - box.height >= EDGE;
      const fitsBelow = anchor.bottom + OFFSET + box.height <= window.innerHeight - EDGE;
      const resolved = side === "top" ? (fitsAbove || !fitsBelow ? "top" : "bottom") : fitsBelow || !fitsAbove ? "bottom" : "top";
      const top = resolved === "top" ? anchor.top - OFFSET - box.height : anchor.bottom + OFFSET;
      bubble.style.top = `${Math.round(top)}px`;
      bubble.style.left = `${Math.round(left)}px`;
      bubble.style.setProperty("--arrow-x", `${Math.round(Math.min(Math.max(ARROW_INSET, centerX - left), box.width - ARROW_INSET))}px`);
      bubble.dataset.side = resolved;
      delete bubble.dataset.measuring;
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [visible, side, align]);

  const close = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === "Escape") setHovered(false);
  };

  return (
    <Root
      ref={rootRef}
      className={className}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={() => setHovered(false)}
      onKeyDown={close}
    >
      {cloneElement(children, { "aria-describedby": visible ? bubbleId : undefined })}
      {visible &&
        createPortal(
          <Bubble ref={bubbleRef} id={bubbleId} role="tooltip" data-side={side} data-measuring="">
            {content}
            <Arrow aria-hidden="true" />
          </Bubble>,
          document.body,
        )}
    </Root>
  );
}
