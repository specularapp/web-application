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
   * largura, deixando a altura sair da folha e descer pela rolagem. `width` é a prévia do celular (decisão
   * de 2026-09-10, a pedido): caber inteira numa tela alta e estreita deixava a folha do tamanho de um selo.
   */
  fit?: "contain" | "width";
};

// A folha onde o documento do orçamento mora, a mesma no editor e na página pública (2026-09-09, a pedido de
// alinhar a prévia, o link e a impressão): tamanho fixo de A4, centrada, e reduzida até caber no espaço que
// sobrou. Tamanho fixo é o ponto, porque é o que faz o que está na tela ser exatamente o que sai no papel;
// quem muda é o espaço em volta, e a folha nunca.
//
// **A redução é `transform: scale`, e não `zoom`** (acerto de 2026-09-10, do relato de que no celular a
// prévia saía quebrada): `zoom` é fator de layout, então o documento é remontado na medida reduzida, e cada
// caixa, fio e entrelinha arredonda para o pixel de novo; a 0,45 da largura de um celular, os fios somem, os
// textos reflui e o desenho deixa de ser o da tela grande. `scale` desenha a folha nos 832px de sempre e
// reduz o resultado, como o leitor de PDF faz com a página: o que se vê é o desktop inteiro, menor, e nada
// se recompõe. O preço é que `scale` não encolhe o espaço ocupado, então o invólucro reserva a altura já
// escalada e a folha nasce da quina de cima, à esquerda.
export function QuotePaper({ children, className, fit = "contain" }: QuotePaperProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;

    const measure = () => {
      const width = frame.clientWidth;
      const height = frame.clientHeight;
      if (!width) return;
      // Ajustando pela largura, a altura não entra na conta: a folha fica na escala da largura disponível e
      // desce pela rolagem, então uma tela baixa não a encolhe.
      const next = fit === "width" ? width / PAGE_WIDTH : Math.min(width / PAGE_WIDTH, height ? height / PAGE_HEIGHT : 1);
      setScale(Math.min(1, next));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [fit]);

  const vars = {
    "--page-width": `${PAGE_WIDTH}px`,
    "--page-height": `${PAGE_HEIGHT}px`,
    "--doc-scale": scale,
  } as CSSProperties;

  return (
    <div ref={ref} className={cx(styles.frame, className)} data-fit={fit} style={vars}>
      {/* A caixa que ocupa o lugar da folha reduzida: `scale` não muda o espaço do que ele desenha, então a
          medida escalada vive aqui, e é ela que a rolagem e a centralização enxergam. */}
      <div className={styles.slot}>
        <div className={styles.page}>{children}</div>
      </div>
    </div>
  );
}
