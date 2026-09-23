import { CheckIcon } from "@phosphor-icons/react/ssr";
import type { AnimationEvent, CSSProperties, ReactNode } from "react";
import styles from "./success-mark.module.css";

export type SuccessMarkProps = {
  /** O que aparece antes do check, dentro do anel; sem nada, o anel se fecha direto no check. */
  children?: ReactNode;
  /** O lado do anel, em pixels. */
  size?: number;
  /** A espessura do traço do anel, em pixels. */
  stroke?: number;
  /** Quanto o anel leva para fechar; quando fecha, o que estava dentro sai e o check entra. */
  ringMs?: number;
};

/**
 * O feito confirmado (2026-09-23, extraído do fim dos primeiros passos para o criar tarefa usar o mesmo): um
 * anel fino se fecha e, quando fecha, o check entra com a mola da casa; com uma marca dentro, ela dá lugar ao
 * check. É só CSS, então não custa nada no cliente e respeita quem pede menos movimento.
 */
export function SuccessMark({ children, size = 88, stroke = 2, ringMs = 1300 }: SuccessMarkProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const vars = {
    "--mark-size": `${size / 16}rem`,
    "--ring-length": `${circumference}px`,
    "--ring-duration": `${ringMs}ms`,
  } as CSSProperties;

  return (
    <span className={styles.mark} style={vars}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className={styles.track} cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        <circle
          className={styles.fill}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children !== undefined && <span className={styles.before}>{children}</span>}
      <CheckIcon weight="bold" className={styles.check} aria-hidden="true" />
    </span>
  );
}

/**
 * O feito por cima de um cartão (2026-09-23): um véu verde translúcido cobre o cartão com o anel se fechando
 * no check, e some sozinho. Só efeito: não muda nada no cartão e não pega o toque. Quem o usa precisa estar
 * posicionado, porque o véu cobre o pai inteiro.
 */
export function SuccessOverlay({ onDone }: { onDone?: () => void }) {
  const done = (event: AnimationEvent<HTMLSpanElement>) => {
    if (event.target === event.currentTarget) onDone?.();
  };

  return (
    <span className={styles.overlay} aria-hidden="true" onAnimationEnd={done}>
      <SuccessMark size={48} stroke={2} ringMs={500} />
    </span>
  );
}
