"use client";

import styled from "@emotion/styled";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "../button";
import { Text } from "../text";

export type SignaturePadProps = {
  /** O traço em PNG embutido a cada mudança; nulo quando a área está limpa. */
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  /** Nome do controle para leitor de tela. */
  label?: string;
};

/* A área do traço: o fundo da casa, o fio tracejado que diz "assine aqui" e a linha de base embaixo, como
   numa folha. Canto `lg` pelo sistema de cantos. `touch-action: none` para o dedo desenhar em vez de rolar. */
const Frame = styled.div`
  position: relative;
  display: grid;
  gap: var(--space-2);
  min-width: 0;
`;

const Canvas = styled.canvas`
  display: block;
  width: 100%;
  height: 11rem;
  cursor: crosshair;
  touch-action: none;
  background-color: var(--color-bg);
  border: 0.0625rem dashed var(--color-label-tertiary);
  border-radius: var(--radius-lg);
  corner-shape: squircle;

  &[data-disabled] {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

/* A linha de assinar, desenhada por cima do canvas para não entrar no traço exportado. */
const Baseline = styled.span`
  position: absolute;
  inset-inline: var(--space-6);
  inset-block-end: 3.25rem;
  height: 0.0625rem;
  pointer-events: none;
  background-color: var(--color-label-tertiary);
`;

const Hint = styled(Text)`
  position: absolute;
  inset-inline: 0;
  inset-block-end: 1.75rem;
  pointer-events: none;
  text-align: center;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
`;

/** O traço mínimo para valer como assinatura: dois pontos são um clique, não um risco. */
const MIN_POINTS = 8;

// O quadro de assinar à mão (2026-09-14, para o contrato): a pessoa desenha com o dedo, a caneta ou o mouse,
// e o que sai é um PNG com fundo transparente, na tinta preta, no dobro da resolução da tela, que é o que o
// documento e o PDF carimbam. Limpar recomeça. A linha de base e a dica ficam fora do canvas, então não
// entram no traço.
export function SignaturePad({ onChange, disabled = false, label = "Área para desenhar a assinatura" }: SignaturePadProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<{ pointer: number; points: number } | null>(null);
  const [empty, setEmpty] = useState(true);
  const strokes = useRef(0);

  /* O canvas mede em pixels de dispositivo e desenha em CSS: sem isso o traço sai serrilhado em tela densa. */
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const fit = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = element.getBoundingClientRect();
      const snapshot = element.width ? element.toDataURL() : null;
      element.width = Math.round(rect.width * ratio);
      element.height = Math.round(rect.height * ratio);
      const context = element.getContext("2d");
      if (!context) return;
      context.scale(ratio, ratio);
      context.lineWidth = 2.2;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = "#000000";
      if (snapshot && strokes.current > 0) {
        const image = new Image();
        image.onload = () => context.drawImage(image, 0, 0, rect.width, rect.height);
        image.src = snapshot;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const position = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    /* Só o ponteiro principal desenha: um segundo dedo apoiado na tela não pode roubar o traço do primeiro. */
    if (disabled || !event.isPrimary) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = position(event);
    context.beginPath();
    context.moveTo(x, y);
    drawing.current = { pointer: event.pointerId, points: 1 };
  };

  const move = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const current = drawing.current;
    if (!current || current.pointer !== event.pointerId) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const { x, y } = position(event);
    context.lineTo(x, y);
    context.stroke();
    current.points += 1;
  };

  const end = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const current = drawing.current;
    if (!current || current.pointer !== event.pointerId) return;
    drawing.current = null;
    strokes.current += current.points;
    if (strokes.current >= MIN_POINTS) {
      setEmpty(false);
      onChange(event.currentTarget.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    context.clearRect(0, 0, element.width, element.height);
    strokes.current = 0;
    setEmpty(true);
    onChange(null);
  };

  return (
    <Frame>
      <Canvas ref={canvas} role="img" aria-label={label} data-disabled={disabled || undefined} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
      <Baseline aria-hidden="true" />
      {empty && (
        <Hint as="span" variant="footnote" tone="tertiary" aria-hidden="true">
          Desenhe sua assinatura aqui
        </Hint>
      )}
      <Row>
        <Text as="span" variant="caption1" tone="secondary">
          Use o dedo, a caneta ou o mouse
        </Text>
        <Button variant="ghost" size="sm" radius="md" iconStart={<ArrowCounterClockwiseIcon />} disabled={disabled || empty} onClick={clear}>
          Limpar
        </Button>
      </Row>
    </Frame>
  );
}
