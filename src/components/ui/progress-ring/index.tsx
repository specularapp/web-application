import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/utils/cx";
import styles from "./progress-ring.module.css";

export type ProgressRingSize = "sm" | "md" | "lg" | "fill";

export type ProgressRingVariant = "ring" | "gauge";

export type ProgressRingProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  /** De 0 a 100. */
  value: number;
  /** Leitura completa para leitor de tela, como "62% até o nível 5". */
  label: string;
  /** `ring` é o círculo inteiro; `gauge` é a meia rosquinha, mais grossa, de pontas retas e com o centro na base. */
  variant?: ProgressRingVariant;
  /** `fill` ocupa a largura de quem o contém, para dividir um bloco ao meio. */
  size?: ProgressRingSize;
  /** Cor do arco, um token de cor; o padrão é o acento. */
  hue?: string;
  /** O que vai no centro, como a porcentagem. */
  children?: ReactNode;
};

const VIEWBOX = 100;
const RING_THICKNESS = 8;
const GAUGE_THICKNESS = 12;
const GAUGE_RADIUS = (VIEWBOX - GAUGE_THICKNESS) / 2;
/** A meia rosquinha é a metade de cima do círculo, com as pontas retas na base: exatamente 2 por 1. */
export const GAUGE_HEIGHT = VIEWBOX / 2;

const gaugePath = `M ${GAUGE_THICKNESS / 2} ${VIEWBOX / 2} A ${GAUGE_RADIUS} ${GAUGE_RADIUS} 0 0 1 ${VIEWBOX - GAUGE_THICKNESS / 2} ${VIEWBOX / 2}`;

// Anel de progresso: trilho apagado e um arco que cresce a partir do começo. O arco tem comprimento
// normalizado em 100 (`pathLength`), então o traço é a própria porcentagem, sem conta de circunferência,
// tanto no círculo inteiro quanto na meia rosquinha.
export function ProgressRing({
  value,
  label,
  variant = "ring",
  size = "md",
  hue,
  className,
  style,
  children,
  ...props
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const vars = { ...style, "--ring-value": clamped, "--ring-hue": hue } as CSSProperties;
  const gauge = variant === "gauge";

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cx(styles.ring, className)}
      data-variant={variant}
      data-size={size}
      style={vars}
      {...props}
    >
      <svg className={styles.svg} viewBox={`0 0 ${VIEWBOX} ${gauge ? GAUGE_HEIGHT : VIEWBOX}`} aria-hidden="true">
        {gauge ? (
          <>
            <path className={styles.track} d={gaugePath} strokeWidth={GAUGE_THICKNESS} />
            <path className={styles.arc} d={gaugePath} strokeWidth={GAUGE_THICKNESS} pathLength={100} />
          </>
        ) : (
          <>
            <circle
              className={styles.track}
              cx={VIEWBOX / 2}
              cy={VIEWBOX / 2}
              r={(VIEWBOX - RING_THICKNESS) / 2}
              strokeWidth={RING_THICKNESS}
            />
            <circle
              className={styles.arc}
              cx={VIEWBOX / 2}
              cy={VIEWBOX / 2}
              r={(VIEWBOX - RING_THICKNESS) / 2}
              strokeWidth={RING_THICKNESS}
              pathLength={100}
            />
          </>
        )}
      </svg>
      {children && <span className={styles.center}>{children}</span>}
    </div>
  );
}
