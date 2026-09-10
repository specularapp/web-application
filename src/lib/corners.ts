export const cornerRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
} as const;

export type CornerRadius = keyof typeof cornerRadius;

export const controlCornerRadius = {
  sm: 20,
  md: 24,
  lg: 28,
} as const;

export type ControlCornerRadius = keyof typeof controlCornerRadius;

export const iconButtonCornerRadius = {
  sm: 18,
  md: 22,
  lg: 26,
} as const;

const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
} as const;

export type Spacing = keyof typeof spacing;

export type SquircleOptions = { clip?: boolean };

function attributes(px: number | undefined, options?: SquircleOptions) {
  return {
    "data-squircle": "",
    ...(px !== undefined && { "data-squircle-radius": String(px) }),
    ...(options?.clip && { "data-squircle-clip": "" }),
  };
}

export function squircle(radius: CornerRadius, options?: SquircleOptions) {
  return attributes(cornerRadius[radius], options);
}

export function squirclePx(px: number, options?: SquircleOptions) {
  return attributes(px, options);
}

export function squircleAuto(options?: SquircleOptions) {
  return attributes(undefined, options);
}

export function concentric(outer: number, inset: Spacing) {
  return Math.max(cornerRadius.xs, outer - spacing[inset]);
}

/**
 * O canto da casa desenhado como caminho, para a forma existir fora do CSS: é a máscara que recorta a foto
 * no PDF do orçamento, onde não há `corner-shape` nem `border-radius` com curva ajustável.
 *
 * `corner-shape: squircle` é a superelipse de expoente 4, |x|⁴ + |y|⁴ = 1 dentro do quadrado do raio, e não
 * o quarto de círculo do `round`. O caminho aproxima cada quina por segmentos retos, o que basta porque a
 * máscara é desenhada num tamanho maior e reduzida depois: o erro de um segmento cabe dentro de um pixel.
 */
export function squirclePath(width: number, height: number, radius: number, steps = 16) {
  const r = Math.min(radius, width / 2, height / 2);
  const n = (value: number) => Number(value.toFixed(2));
  /* O outro eixo da superelipse: em `u` de 0 a 1, um eixo anda reto e este descreve a curva. */
  const curve = (u: number) => r * (1 - u ** 4) ** 0.25;
  const arc = (point: (u: number) => [number, number]) =>
    Array.from({ length: steps + 1 }, (_, index) => index / steps)
      .map((u) => point(u))
      .map(([x, y]) => `L ${n(x)} ${n(y)}`)
      .join(" ");

  return [
    `M ${n(r)} 0`,
    `L ${n(width - r)} 0`,
    arc((u) => [width - r + r * u, r - curve(u)]),
    `L ${n(width)} ${n(height - r)}`,
    arc((u) => [width - r + curve(u), height - r + r * u]),
    `L ${n(r)} ${n(height)}`,
    arc((u) => [r - r * u, height - r + curve(u)]),
    `L 0 ${n(r)}`,
    arc((u) => [r - curve(u), r - r * u]),
    "Z",
  ].join(" ");
}
