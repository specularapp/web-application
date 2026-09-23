export const cornerRadius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  "2xl": 14,
  "3xl": 16,
} as const;

export type CornerRadius = keyof typeof cornerRadius;

export const controlCornerRadius = {
  sm: 6,
  md: 8,
  lg: 10,
} as const;

export type ControlCornerRadius = keyof typeof controlCornerRadius;

export const iconButtonCornerRadius = {
  sm: 6,
  md: 8,
  lg: 10,
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

export type RoundedOptions = { clip?: boolean };

const radiusEntries = Object.entries(cornerRadius) as [CornerRadius, number][];

function closestRadius(px: number): CornerRadius {
  return radiusEntries.reduce((closest, entry) =>
    Math.abs(entry[1] - px) < Math.abs(cornerRadius[closest] - px) ? entry[0] : closest,
  "xs" as CornerRadius);
}

function attributes(radius: CornerRadius | undefined, options?: RoundedOptions) {
  return {
    ...(radius !== undefined && { "data-corner-radius": radius }),
    ...(options?.clip && { "data-corner-clip": "" }),
  };
}

export function rounded(radius: CornerRadius, options?: RoundedOptions) {
  return attributes(radius, options);
}

export function roundedPx(px: number, options?: RoundedOptions) {
  return attributes(closestRadius(px), options);
}

export function roundedAuto(options?: RoundedOptions) {
  return attributes(undefined, options);
}

export function concentric(outer: number, inset: Spacing) {
  return Math.max(cornerRadius.xs, outer - spacing[inset]);
}

/**
 * Retângulo arredondado em SVG para o PDF usar o mesmo raio circular do CSS.
 */
export function roundedRectPath(width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  const n = (value: number) => Number(value.toFixed(2));
  return [
    `M ${n(r)} 0`,
    `H ${n(width - r)}`,
    `A ${n(r)} ${n(r)} 0 0 1 ${n(width)} ${n(r)}`,
    `V ${n(height - r)}`,
    `A ${n(r)} ${n(r)} 0 0 1 ${n(width - r)} ${n(height)}`,
    `H ${n(r)}`,
    `A ${n(r)} ${n(r)} 0 0 1 0 ${n(height - r)}`,
    `V ${n(r)}`,
    `A ${n(r)} ${n(r)} 0 0 1 ${n(r)} 0`,
    "Z",
  ].join(" ");
}
