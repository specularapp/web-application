"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

export type AnchorPlacement = "below" | "above";

export type AnchorPosition = { top: number; left: number; placement: AnchorPlacement };

export type AnchorOptions = {
  /** Largura da caixa, em pixels, para ela não passar da borda da janela. */
  width: number;
  /** Altura estimada, também em pixels: é o que decide se ela abre para baixo ou para cima. */
  height: number;
  gap?: number;
  edge?: number;
};

const GAP = 8;
const EDGE = 16;

/**
 * Posição de uma caixa colada no próprio gatilho. Mede em `useLayoutEffect`, e não em `useEffect`,
 * senão ela pinta no canto e pula para o lugar no quadro seguinte, com o pulo entrando junto com a
 * animação de entrada. A altura é estimada em vez de medida pelo mesmo motivo: medir depois de montar
 * faria a caixa aparecer embaixo e saltar para cima.
 */
export function useAnchoredPosition(
  open: boolean,
  trigger: RefObject<HTMLElement | null>,
  { width, height, gap = GAP, edge = EDGE }: AnchorOptions,
) {
  const [position, setPosition] = useState<AnchorPosition | null>(null);

  useLayoutEffect(() => {
    if (!open) return;

    const update = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;

      const box = Math.min(width, window.innerWidth - edge * 2);
      const left = Math.min(Math.max(edge, rect.left), window.innerWidth - box - edge);
      const below = window.innerHeight - rect.bottom;
      const placement: AnchorPlacement = below < height && rect.top > below ? "above" : "below";

      setPosition({ top: placement === "below" ? rect.bottom + gap : rect.top - gap, left, placement });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, trigger, width, height, gap, edge]);

  return position;
}
