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

export const CORNER_SMOOTHING = 0.8;

type CornerBorder = { width?: number; color: string };

function attributes(px: number, border?: CornerBorder) {
  return {
    "data-squircle": "",
    "data-squircle-radius": String(px),
    ...(border && {
      "data-squircle-border-width": String(border.width ?? 1),
      "data-squircle-border-color": border.color,
    }),
  };
}

export function squircle(radius: CornerRadius, border?: CornerBorder) {
  return attributes(cornerRadius[radius], border);
}

export function squirclePx(px: number, border?: CornerBorder) {
  return attributes(px, border);
}

export function squircleAuto(border?: CornerBorder) {
  return {
    "data-squircle": "",
    ...(border && {
      "data-squircle-border-width": String(border.width ?? 1),
      "data-squircle-border-color": border.color,
    }),
  };
}

export function concentric(outer: number, inset: Spacing) {
  return Math.max(cornerRadius.xs, outer - spacing[inset]);
}
