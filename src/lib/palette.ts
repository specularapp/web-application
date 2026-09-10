/**
 * Os doze matizes da paleta do sistema em hex, no valor do tema claro, e o quarteto de cor da aura de cada
 * um. A origem é `styles/tokens.css`; aqui eles viram valor cru para quem desenha fora do CSS: a imagem que
 * o WhatsApp mostra ao lado do link (satori, em `opengraph-image.tsx`) e o PDF do orçamento (react-pdf).
 * Nenhum dos dois resolve `light-dark()`, `color-mix()` ou `oklch()`, e os dois desenham a mesma folha que
 * a tela, então o valor precisa existir também assim.
 */
export const sysHues = {
  red: "#ff3b30",
  orange: "#ff9500",
  yellow: "#ffcc00",
  green: "#34c759",
  mint: "#00c7be",
  teal: "#30b0c7",
  cyan: "#32ade6",
  blue: "#007aff",
  indigo: "#5856d6",
  purple: "#af52de",
  pink: "#ff2d55",
  brown: "#a2845e",
} as const;

export type SysHue = keyof typeof sysHues;

/**
 * A aura da folha em quatro cores, na ordem das quinas: topo à esquerda, topo à direita, base à esquerda e
 * base à direita. É a mesma conta que o CSS do documento faz, `oklch(from var(--doc-hue) l c calc(h ± n))`
 * girando o matiz em -45, +45 e +150 para as três outras quinas, resolvida uma vez e escrita aqui: girar
 * matiz em tempo de desenho pediria a matemática do oklab inteira para um valor que nunca muda.
 */
export const auraCorners: Record<SysHue, readonly [string, string, string, string]> = {
  red: ["#ff3b30", "#e940b3", "#e06e00", "#00b992"],
  orange: ["#ff9500", "#ff7e89", "#bfb900", "#00cdf4"],
  yellow: ["#ffcc00", "#ffa968", "#9dec6f", "#48dfff"],
  green: ["#34c759", "#c1aa00", "#00cbc8", "#b788ff"],
  mint: ["#00c7be", "#78c377", "#48baf2", "#e38cc8"],
  teal: ["#30b0c7", "#4cb491", "#72a0e3", "#d78098"],
  cyan: ["#32ade6", "#00bab1", "#8f97f2", "#e87d78"],
  blue: ["#007aff", "#009ccc", "#9c54ea", "#e14200"],
  indigo: ["#5856d6", "#0077c6", "#9d38a9", "#af4b00"],
  purple: ["#af52de", "#4d76ff", "#e03785", "#9f8400"],
  pink: ["#ff2d55", "#dd42cc", "#ed5d00", "#00b871"],
  brown: ["#a2845e", "#ae7b74", "#868f63", "#5d93a6"],
};

/**
 * O véu de uma cor da paleta, o que o CSS escreve como `color-mix(in oklab, var(--sys-x) 12%, transparent)`:
 * a mesma cor com opacidade, que é no que a mistura com transparente dá. Serve ao azulejo do item e ao tinte
 * da etiqueta em quem não tem `color-mix`.
 */
export function withAlpha(hex: string, alpha: number) {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}
