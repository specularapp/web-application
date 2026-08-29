import { css } from "@emotion/react";

export type ControlSize = "sm" | "md" | "lg";

const controlFontSize: Record<ControlSize, string> = {
  sm: "var(--text-footnote)",
  md: "var(--text-subheadline)",
  lg: "var(--text-body)",
};

export const focusRing = css`
  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
`;

export const disabledState = css`
  &:disabled,
  &[aria-disabled="true"] {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

export const controlMetrics = (size: ControlSize) => css`
  min-height: var(--control-height-${size});
  padding-inline: var(--control-padding-${size});
  font-size: ${controlFontSize[size]};

  @media (pointer: coarse) {
    min-height: max(var(--control-height-${size}), var(--touch-target));
  }
`;

const glyphRatio = 0.45;

export const controlSquare = (size: ControlSize) => css`
  width: var(--control-height-${size});
  height: var(--control-height-${size});
  padding: 0;

  @media (pointer: coarse) {
    width: max(var(--control-height-${size}), var(--touch-target));
    height: max(var(--control-height-${size}), var(--touch-target));
  }
`;

export const controlGlyph = (size: ControlSize) => css`
  width: calc(var(--control-height-${size}) * ${glyphRatio});
  height: calc(var(--control-height-${size}) * ${glyphRatio});
`;
