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
