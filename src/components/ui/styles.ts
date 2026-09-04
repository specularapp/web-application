import { css, keyframes } from "@emotion/react";

export type ControlSize = "sm" | "md" | "lg";

export const popIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(var(--slide)) scale(0.97);
  }
`;

export const fadeIn = keyframes`
  from {
    opacity: 0;
  }
`;

export const fadeOut = keyframes`
  to {
    opacity: 0;
  }
`;

/* Gênio da lâmpada, na versão que o CSS alcança: a camada nasce menor e mais perto de quem a abriu
   (`--genie-x` e `--genie-y` dizem de onde) e cresce até o lugar com uma mola curta; ao fechar volta
   pelo mesmo caminho, mais rápido e sem mola, porque saída não pede atenção. */
export const genieIn = keyframes`
  from {
    opacity: 0;
    transform: translate3d(var(--genie-x, 0px), var(--genie-y, 0px), 0) scale(0.9);
  }
`;

export const genieOut = keyframes`
  to {
    opacity: 0;
    transform: translate3d(var(--genie-x, 0px), var(--genie-y, 0px), 0) scale(0.94);
  }
`;

/* Entrada e saída de toda camada flutuante da casa, lidas de `data-state`. Quem monta a camada usa
   `usePresence`, que a mantém na tela até a saída terminar. Com movimento reduzido sobra só o fade:
   a regra é sobre deslocamento, e opacidade não desloca nada. */
export const layerMotion = css`
  &[data-state="open"] {
    animation: ${genieIn} var(--duration-base) var(--ease-spring) both;
  }

  &[data-state="closed"] {
    pointer-events: none;
    animation: ${genieOut} var(--duration-fast) var(--ease-standard) both;
  }

  @media (prefers-reduced-motion: reduce) {
    &[data-state="open"] {
      animation: ${fadeIn} var(--duration-fast) linear both;
    }

    &[data-state="closed"] {
      animation: ${fadeOut} var(--duration-fast) linear both;
    }
  }
`;

/* Hover de todo controle da casa. A transição é assimétrica de propósito: entrar no hover leva o
   tempo base, para a cor chegar macia, e sair leva o tempo curto, para o ponteiro que passa por uma
   lista não deixar rastro. O clique afunda um fio e volta, que é o retorno tátil que o Mac dá. */
export const hoverMotion = css`
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard),
    opacity var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);

  &:hover {
    transition-duration: var(--duration-base);
  }

  &:active:not(:disabled) {
    transform: scale(0.985);
    transition-duration: 60ms;
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

