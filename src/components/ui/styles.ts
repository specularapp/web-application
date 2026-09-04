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
  /* As duas famílias não convivem: assim que a largura ou a cor padrão da barra aparecem na regra, o
     Chrome descarta os pseudo-elementos inteiros e cai na barra nativa, que no Windows vem grossa e
     com uma seta em cada ponta. Por isso as propriedades padrão ficam só onde os pseudo-elementos não
     existem, que é o Firefox, e o resto do desenho vive neles. */
  @supports not selector(::-webkit-scrollbar) {
    scrollbar-width: thin;
    scrollbar-color: var(--color-fill-quaternary) transparent;
  }

  &::-webkit-scrollbar {
    width: 0.125rem;
    height: 0.125rem;
  }

  &::-webkit-scrollbar-button {
    display: none;
    width: 0;
    height: 0;
  }

  &::-webkit-scrollbar-track,
  &::-webkit-scrollbar-corner {
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
