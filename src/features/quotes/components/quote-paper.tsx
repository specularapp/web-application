"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cx } from "@/lib/utils/cx";
import styles from "./quote-paper.module.css";

/** A folha em pixels: a largura de página do documento e a altura na proporção do A4 (842 sobre 595). */
export const PAGE_WIDTH = 832;
export const PAGE_RATIO = 842 / 595;
export const PAGE_HEIGHT = Math.round(PAGE_WIDTH * PAGE_RATIO);

export type QuotePaperProps = {
  children: ReactNode;
  className?: string;
};

// A folha onde o documento do orçamento mora, a mesma no editor e na página pública (2026-09-09, a pedido de
// alinhar a prévia, o link e a impressão): tamanho fixo de A4, centrada, e `zoom` reduzindo até caber inteira
// no espaço que sobrou. Tamanho fixo é o ponto, porque é o que faz o que está na tela ser exatamente o que
// sai no papel; quem muda é o espaço em volta, e a folha nunca. No celular ela vira fluida, porque uma A4
// reduzida numa tela de 360px viraria texto de cinco pixels, e na impressão volta ao tamanho de folha com a
// escala que mapeia os 832px em 210mm.
export function QuotePaper({ children, className }: QuotePaperProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const paper = ref.current;
    if (!paper) return;

    const measure = () => {
      const width = paper.clientWidth;
      const height = paper.clientHeight;
      if (!width || !height) return;
      setZoom(Math.min(1, width / PAGE_WIDTH, height / PAGE_HEIGHT));
    };

    const observer = new ResizeObserver(measure);
    observer.observe(paper);
    return () => observer.disconnect();
  }, []);

  const vars = { "--page-width": `${PAGE_WIDTH}px`, "--page-height": `${PAGE_HEIGHT}px`, "--doc-zoom": zoom } as CSSProperties;

  return (
    <div ref={ref} className={cx(styles.paper, className)} style={vars}>
      {children}
    </div>
  );
}
