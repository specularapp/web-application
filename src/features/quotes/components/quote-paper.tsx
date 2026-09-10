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
  /**
   * Como a folha cabe no espaço: `contain` reduz até a página inteira aparecer, e `width` reduz só pela
   * largura, deixando a altura sair da folha e rolar. `width` é a prévia do celular (2026-09-10, a pedido):
   * caber inteira numa tela alta e estreita deixava a folha do tamanho de um selo, e o pedido é ver o
   * documento na escala em que ele é impresso, descendo por ele, como num leitor de PDF.
   */
  fit?: "contain" | "width";
};

// A folha onde o documento do orçamento mora, a mesma no editor e na página pública (2026-09-09, a pedido de
// alinhar a prévia, o link e a impressão): tamanho fixo de A4, centrada, e `zoom` reduzindo até caber inteira
// no espaço que sobrou. Tamanho fixo é o ponto, porque é o que faz o que está na tela ser exatamente o que
// sai no papel; quem muda é o espaço em volta, e a folha nunca. No celular também (decisão de 2026-09-10, a
// pedido): a folha não vira fluida, ela só encolhe até caber na largura da tela, como uma prévia de página,
// e quem quer ler aproxima; a versão fluida, que existiu por um dia, refazia o documento e ele deixava de
// ser o que o cliente recebe. Na impressão volta ao tamanho de folha com a escala que mapeia os 832px em
// 210mm.
export function QuotePaper({ children, className, fit = "contain" }: QuotePaperProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const paper = ref.current;
    if (!paper) return;

    const measure = () => {
      const width = paper.clientWidth;
      const height = paper.clientHeight;
      if (!width) return;
      // Ajustando pela largura, a altura não entra na conta: a folha fica na escala da largura disponível e
      // desce pela rolagem, então uma tela baixa não a encolhe.
      if (fit === "width") {
        setZoom(Math.min(1, width / PAGE_WIDTH));
        return;
      }
      if (!height) return;
      setZoom(Math.min(1, width / PAGE_WIDTH, height / PAGE_HEIGHT));
    };

    const observer = new ResizeObserver(measure);
    observer.observe(paper);
    return () => observer.disconnect();
  }, [fit]);

  const vars = { "--page-width": `${PAGE_WIDTH}px`, "--page-height": `${PAGE_HEIGHT}px`, "--doc-zoom": zoom } as CSSProperties;

  return (
    <div ref={ref} className={cx(styles.paper, className)} data-fit={fit} style={vars}>
      {children}
    </div>
  );
}
