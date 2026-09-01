import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import styles from "./onboarding.module.css";

type StepRingProps = {
  total: number;
  current: number;
};

const SIZE = 32;
const STROKE = 2.5;
const GAP = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Um arco por etapa no mesmo círculo: cada um mostra só o próprio pedaço do traço (dasharray) e
// começa no ponto certo (dashoffset). A ponta arredondada come metade da espessura de cada lado,
// então o vão declarado já conta com isso.
export function StepRing({ total, current }: StepRingProps) {
  const slice = CIRCUMFERENCE / total;
  const segment = slice - GAP;

  return (
    <span className={styles.ring}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <circle
            key={index}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            stroke={index < current ? "var(--color-brand)" : "var(--color-fill)"}
            strokeDasharray={`${segment} ${CIRCUMFERENCE - segment}`}
            strokeDashoffset={-(index * slice + GAP / 2)}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        ))}
      </svg>
      <Text variant="caption1" weight="semibold" numeric>
        {current}
      </Text>
      <VisuallyHidden>
        Etapa {current} de {total}
      </VisuallyHidden>
    </span>
  );
}
