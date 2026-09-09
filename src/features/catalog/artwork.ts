import "server-only";
import { Avatar, Style } from "@dicebear/core";
import loops from "@dicebear/styles/loops.json";
import { memoizeSvg, stripSvgMetadata } from "@/lib/generated-svg";
import type { CatalogHue } from "./summary";

/**
 * A arte gerada de um item do catálogo sem foto, no estilo Loops do DiceBear: voltas abstratas com a linha
 * tingida no matiz do item. Desenhada no servidor pela rota `/api/artwork/[hue]/[token]`, sobre a moldura
 * comum de `lib/generated-svg.ts`; o endereço quem monta é `catalogArtworkUrl`, em `list-options.ts`.
 */

/**
 * O hex de cada matiz sem `#`, como o DiceBear pede. É o valor do tema escuro, porque o arquivo não muda
 * com o tema; o azulejo em volta, esse sim no token, é quem faz a cor casar nos dois.
 */
export const artworkHues: Record<CatalogHue, string> = {
  red: "ff453a",
  orange: "ff9f0a",
  yellow: "ffd60a",
  green: "30d158",
  mint: "63e6e2",
  teal: "40c8e0",
  cyan: "64d2ff",
  blue: "0a84ff",
  indigo: "5e5ce6",
  purple: "bf5af2",
  pink: "ff375f",
  brown: "ac8e68",
};

/** O matiz vem do caminho da URL, então só entra o que está na lista. */
export function isCatalogHue(value: string): value is CatalogHue {
  return value in artworkHues;
}

/* Fundo transparente: o azulejo do componente é quem pinta o fundo, no matiz do item e sensível ao tema. */
const TRANSPARENT = "00000000";

const style = new Style(loops);

const render = memoizeSvg((key) => {
  const [hue, token] = key.split(":") as [CatalogHue, string];
  return stripSvgMetadata(new Avatar(style, { seed: token, lineColor: artworkHues[hue], backgroundColor: TRANSPARENT }).toString());
});

export function artworkSvg(hue: CatalogHue, token: string) {
  return render(`${hue}:${token}`);
}
