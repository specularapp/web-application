import styles from "./sparkline.module.css";

const WIDTH = 240;
const HEIGHT = 44;

/**
 * A curva do saldo no pé do cartão da conta (2026-10-27, da Le Ange): uma linha com a área embaixo, no matiz da
 * conta, sem eixo nem número, porque o número grande já está logo acima. SVG à mão, sem biblioteca de gráfico:
 * são trinta pontos e uma linha.
 */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => [(index / (values.length - 1)) * WIDTH, HEIGHT - 4 - ((value - min) / span) * (HEIGHT - 8)] as const);
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

  return (
    <svg className={styles.spark} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <path className={styles.area} d={`${line} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`} />
      <path className={styles.line} d={line} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
