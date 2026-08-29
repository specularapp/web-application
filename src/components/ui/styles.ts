import { css, keyframes } from "@emotion/react";

export type ControlSize = "sm" | "md" | "lg";

export const popIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(var(--slide)) scale(0.97);
  }
`;

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

export const fieldMetrics = (size: ControlSize) => css`
  min-height: var(--control-height-${size});
  padding-inline: var(--control-padding-${size});
  font-size: max(16px, ${controlFontSize[size]});

  @media (pointer: coarse) {
    min-height: max(var(--control-height-${size}), var(--touch-target));
  }
`;

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

export const thinScrollbar = css`
  scrollbar-width: thin;
  scrollbar-color: var(--color-fill-quaternary) transparent;

  &:hover {
    scrollbar-color: var(--color-fill) transparent;
  }

  &::-webkit-scrollbar {
    width: 0.375rem;
    height: 0.375rem;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: var(--color-fill-quaternary);
    border-radius: var(--radius-full);
  }

  &:hover::-webkit-scrollbar-thumb {
    background-color: var(--color-fill);
  }
`;
