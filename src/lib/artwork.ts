import "server-only";
import { Avatar, Style } from "@dicebear/core";
import icons from "@dicebear/styles/icons.json";
import waves from "@dicebear/styles/waves.json";
import { memoizeSvg, stripSvgMetadata, type ArtworkStyle } from "./generated-svg";
import type { SysHue } from "./palette";

/**
 * A arte gerada de quem não tem foto, tingida no matiz de quem a pede. Mora em `lib`, e não em `features`
 * (2026-09-16, quando o projeto ganhou um estilo próprio): ela desenha para o catálogo e para os projetos, e
 * um dos dois importando o arquivo do outro fazia parecer que a arte era do catálogo e o projeto pegava
 * carona. Aqui ela não é de domínio nenhum, como a moldura de `generated-svg.ts` logo ao lado.
 *
 * Só o servidor desenha: quem monta o endereço no cliente usa `svgToken`, sem trazer o DiceBear para o
 * navegador. Construir cada estilo aqui no escopo do módulo é caro e não tem lugar no bundle do cliente; o
 * `server-only` garante que ninguém o importe de lá por engano.
 */

/**
 * O hex de cada matiz sem `#`, como o DiceBear pede. É o valor do tema escuro, e não o de `lib/palette.ts`,
 * que é o do claro: o arquivo não muda com o tema, e o azulejo em volta, esse sim no token, é quem faz a cor
 * casar nos dois.
 */
export const artworkHues: Record<SysHue, string> = {
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
  gray: "8e8e93",
};

/** O matiz vem do caminho da URL, então só entra o que está na lista. */
export function isArtworkHue(value: string): value is SysHue {
  return value in artworkHues;
}

/**
 * Os estilos em uso, cada um com o nome da opção que tinge o desenho, porque ela muda de estilo para estilo.
 * O nome é o do DiceBear de propósito: ele vai no endereço da rota, e quem for depurar um desenho na aba de
 * rede acha a página do estilo pelo mesmo nome.
 *
 * **Icons** é o item do catálogo (a pedido, 2026-09-16): produto e serviço são coisas, e um ícone diz o que
 * a linha do orçamento é antes de a pessoa ler o nome. **Waves** é a capa de um projeto sem imagem (a
 * pedido, no mesmo dia): faixas que preenchem a capa inteira, que é o que uma capa pede, e não um símbolo
 * centrado dizendo o que o projeto é, coisa que desenho nenhum sabe.
 */
const drawings: Record<ArtworkStyle, { style: Style; tint: string }> = {
  icons: { style: new Style(icons), tint: "iconColor" },
  waves: { style: new Style(waves), tint: "waveColor" },
};

/* Fundo transparente: o azulejo de quem chama é que pinta o fundo, no matiz e sensível ao tema. Sem isto
   cada estilo pinta um fundo próprio, de uma paleta que não é a da casa. */
const TRANSPARENT = "00000000";

const render = memoizeSvg((key) => {
  const [style, hue, token] = key.split(":") as [ArtworkStyle, SysHue, string];
  const drawing = drawings[style];
  const svg = new Avatar(drawing.style, { seed: token, [drawing.tint]: artworkHues[hue], backgroundColor: TRANSPARENT });
  return stripSvgMetadata(svg.toString());
});

export function artworkSvg(style: ArtworkStyle, hue: SysHue, token: string) {
  return render(`${style}:${hue}:${token}`);
}
