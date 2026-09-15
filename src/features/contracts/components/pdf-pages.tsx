"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { cx } from "@/lib/utils/cx";
import styles from "./pdf-pages.module.css";

export type PdfPageSize = { width: number; height: number };

export type PdfPagesProps = {
  /** O endereço do PDF, servido pela rota `arquivo`. */
  src: string;
  /** O que vai por cima de cada página, no mesmo retângulo dela: os campos de assinatura. */
  overlay?: (page: number, size: PdfPageSize) => ReactNode;
  /** Chamado quando uma página é desenhada, com a medida em pixels da tela. */
  onPage?: (page: number, size: PdfPageSize) => void;
  className?: string;
};

type RenderedPage = { number: number; width: number; height: number };

/** A largura máxima em que uma página é desenhada: a de uma folha A4 na tela, a mesma do orçamento. */
const MAX_WIDTH = 832;

// As páginas de um PDF desenhadas no navegador pelo pdf.js (2026-09-14, para o contrato anexado): cada uma
// num canvas no tamanho da coluna, com uma camada por cima na medida exata da página, onde os campos de
// assinatura moram em frações. É a mesma peça no editor de campos, na janela do contrato e na página
// pública de assinar. O pdf.js entra só no navegador, por importação dinâmica, porque ele mexe em APIs de
// tela que não existem no servidor; o worker dele é o do próprio pacote, resolvido pelo empacotador.
export function PdfPages({ src, overlay, onPage, className }: PdfPagesProps) {
  const column = useRef<HTMLDivElement>(null);
  const canvases = useRef(new Map<number, HTMLCanvasElement>());
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(0);

  /* A coluna mede a própria largura, e as páginas são desenhadas nela: redimensionar a janela redesenha. */
  useEffect(() => {
    const element = column.current;
    if (!element) return;
    const measure = () => setWidth(Math.min(MAX_WIDTH, element.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!width) return;
    let cancelled = false;

    const draw = async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const document = await pdfjs.getDocument({ url: src }).promise;
        if (cancelled) return;

        const sizes: RenderedPage[] = [];
        for (let number = 1; number <= document.numPages; number += 1) {
          const page = await document.getPage(number);
          const base = page.getViewport({ scale: 1 });
          const scale = width / base.width;
          sizes.push({ number, width: Math.round(base.width * scale), height: Math.round(base.height * scale) });
        }
        if (cancelled) return;
        setPages(sizes);
        sizes.forEach((size) => onPage?.(size.number, { width: size.width, height: size.height }));

        /* Os canvas existem depois do render das medidas, então o desenho espera um quadro. */
        await new Promise((resolve) => requestAnimationFrame(resolve));
        for (const size of sizes) {
          if (cancelled) return;
          const canvas = canvases.current.get(size.number);
          const context = canvas?.getContext("2d");
          if (!canvas || !context) continue;
          const page = await document.getPage(size.number);
          const ratio = window.devicePixelRatio || 1;
          const viewport = page.getViewport({ scale: (size.width / page.getViewport({ scale: 1 }).width) * ratio });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvas, canvasContext: context, viewport }).promise;
        }
      } catch (cause) {
        console.error("pdf.js falhou:", cause);
        if (!cancelled) setError("Não deu para mostrar este PDF aqui. Baixe o arquivo para conferir.");
      }
    };

    void draw();
    return () => {
      cancelled = true;
    };
    // `onPage` é um relato, não uma dependência: quem o passa o recria a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, width]);

  return (
    <div ref={column} className={cx(styles.column, className)}>
      {error ? (
        <Text variant="footnote" tone="secondary" className={styles.note}>
          {error}
        </Text>
      ) : pages.length === 0 ? (
        <div className={styles.loading}>
          <Spinner size="md" label="Carregando o documento" />
        </div>
      ) : (
        pages.map((page) => (
          <div key={page.number} className={styles.page} style={{ width: page.width, height: page.height }}>
            <canvas
              ref={(element) => {
                if (element) canvases.current.set(page.number, element);
                else canvases.current.delete(page.number);
              }}
              className={styles.canvas}
              aria-label={`Página ${page.number}`}
            />
            {overlay && <div className={styles.overlay}>{overlay(page.number, { width: page.width, height: page.height })}</div>}
            <Text as="span" variant="caption2" tone="tertiary" className={styles.number}>
              {page.number} de {pages.length}
            </Text>
          </div>
        ))
      )}
    </div>
  );
}
