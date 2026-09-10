import type { BadgeTone } from "@/components/ui/badge";

/**
 * Os tokens da casa convertidos para o PDF. O documento em PDF é a mesma folha da tela, no mesmo desenho e
 * na mesma proporção, mas medida em pontos: o react-pdf não lê CSS, então cada medida e cada cor precisa
 * chegar já resolvida.
 *
 * A conta é uma só, e é o que faz o PDF ser a folha e não uma versão dela: a folha da tela tem 832 px de
 * largura e o A4 tem 595,28 pt, então tudo que vem do CSS entra multiplicado por essa razão. Uma fonte de
 * 13 px na tela sai com 9,3 pt no papel, que é o mesmo tamanho relativo, e as proporções batem sem ninguém
 * escolher número novo. É a mesma redução que a impressão do navegador faz com `zoom`.
 */

/** A folha na tela, em pixels: a largura de `quote-paper.tsx`, que é a medida de onde tudo deriva. */
export const SHEET_WIDTH = 832;

/** O A4 em pontos, na medida do react-pdf: 210 por 297 mm a 72 pontos por polegada. */
export const PAGE_WIDTH = 595.276;
export const PAGE_HEIGHT = 841.89;

const scale = PAGE_WIDTH / SHEET_WIDTH;

/** Um valor do CSS, em pixels, no ponto que ele vale no papel. */
export const pt = (px: number) => Math.round(px * scale * 100) / 100;

/** A escala tipográfica de `tokens.css`, em pontos. */
export const type = {
  caption2: pt(11),
  caption1: pt(12),
  footnote: pt(13),
  subheadline: pt(15),
  headline: pt(17),
  title3: pt(20),
  title2: pt(22),
  title1: pt(28),
};

/**
 * O espaçamento entre letras de `tokens.css`, em em: no react-pdf ele vai em pontos, então cada uso
 * multiplica pelo tamanho da fonte. Vale para todo texto que na tela passa pelo `Text` da casa, porque cada
 * variante dele já traz um espaçamento; o que é escrito direto em CSS não tem nenhum, e aqui também não.
 */
export const tracking = { tightest: -0.06, tighter: -0.04, tight: -0.02, wide: 0.06 };

/** Os pesos da Inter que o documento usa, com os arquivos registrados em `pdf.ts`. */
export const weight = { regular: 400, medium: 500, semibold: 600 } as const;

/** As alturas de linha de `tokens.css`, que no react-pdf são multiplicador, como no CSS. */
export const leading = { tight: 1.2, normal: 1.45 };

/** A escala de espaço de `tokens.css`, em pontos. */
export const space = {
  half: pt(2),
  s1: pt(4),
  s2: pt(8),
  s3: pt(12),
  s4: pt(16),
  s5: pt(20),
  s6: pt(24),
  s8: pt(32),
};

/**
 * Um texto no tamanho e na entrelinha da casa, o par que todo texto do documento declara.
 *
 * A entrelinha vai escrita em cada texto de propósito: no react-pdf ela não desce da página nem do container
 * para o texto, como desceria no CSS, e sem ela cada linha assentava na métrica natural da fonte, mais curta
 * que a altura de linha da casa. O bloco do cliente saía cinco pontos mais baixo do que na tela (medido em
 * 2026-09-09, com as duas folhas lado a lado).
 *
 * Declarar `height` no texto também acertava a medida, e foi o primeiro caminho, mas some: o leitor de PDF
 * de verdade corta o texto que tem altura declarada, e o nome do cliente e do item desapareciam no arquivo
 * baixado, ainda que aparecessem no desenho do navegador (relato de 2026-09-09). Altura nunca; entrelinha
 * sempre.
 */
export const text = (size: number, height = leading.normal) => ({ fontSize: size, lineHeight: height });

/** Uma linha só, com reticências no que passar dela: é o `truncate` da casa. */
export const oneLine = { maxLines: 1, textOverflow: "ellipsis" as const };

/** O fio da casa no documento, o `--doc-line` de 0,0375rem. */
export const hairline = pt(0.6);

/**
 * A tinta dos glifos e das marcas vai em hex com opacidade à parte, e não em `rgba`: no desenho vetorial do
 * react-pdf o preenchimento em `rgba` não é lido, e o traço saía na cor de erro em vez de apagado (visto no
 * primeiro PDF gerado, 2026-09-09). Em texto o `rgba` funciona, então só o vetor precisa desta forma.
 */
export const glyphInk = "#3c3c43";
export const glyphOpacity = { secondary: 0.6, tertiary: 0.3 };

/** A marca do meio de pagamento é o cinza terciário com os 65% de opacidade do rodapé, um valor só. */
export const brandOpacity = glyphOpacity.tertiary * 0.65;

/**
 * A tinta do tema claro, porque papel é branco em qualquer tema, como na tela. Os valores com transparência
 * vão em `rgba`, que é o que o react-pdf entende, e o cartão das partes já vem misturado: ele é opaco no
 * CSS justamente para a aura não passar por dentro dele.
 */
export const ink = {
  label: "#000000",
  secondary: "rgba(60, 60, 67, 0.6)",
  tertiary: "rgba(60, 60, 67, 0.3)",
  border: "rgba(60, 60, 67, 0.12)",
  sheet: "#fbfbfc",
  /** `color-mix(in oklab, var(--color-label) 4%, var(--color-bg))`, resolvido. */
  card: "#eeeeef",
};

/**
 * A etiqueta na variante suave da casa: o fundo é o matiz do tom em véu de 9% e a letra é o matiz escurecido,
 * o `color-mix(in oklab, hue 70%, var(--color-label))` já resolvido. Só os tons que o documento usa entram:
 * a situação do orçamento e a cortesia da linha.
 */
export const badgeTones: Record<string, { ink: string; tint: string }> = {
  neutral: { ink: "#565659", tint: "rgba(142, 142, 147, 0.09)" },
  accent: { ink: "#00499e", tint: "rgba(0, 122, 255, 0.09)" },
  info: { ink: "#1b6a8e", tint: "rgba(50, 173, 230, 0.09)" },
  success: { ink: "#1c7a34", tint: "rgba(52, 199, 89, 0.09)" },
  warning: { ink: "#9e5a00", tint: "rgba(255, 149, 0, 0.09)" },
  danger: { ink: "#9e211a", tint: "rgba(255, 59, 48, 0.09)" },
};

/** O tom de uma etiqueta, com o cinza da casa para quem não estiver na lista de cima. */
export const badgeTone = (tone: BadgeTone) => badgeTones[tone] ?? badgeTones.neutral;
