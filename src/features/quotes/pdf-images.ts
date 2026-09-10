import "server-only";
import sharp, { type Sharp } from "sharp";
import { avatarHue } from "@/components/ui/avatar";
import { avatarSvg } from "@/components/ui/avatar/shape";
import { artworkSvg } from "@/features/catalog/artwork";
import { catalogHueFor } from "@/features/catalog/list-options";
import { iconButtonCornerRadius, squirclePath } from "@/lib/corners";
import { svgToken } from "@/lib/generated-svg";
import type { SysHue } from "@/lib/palette";
import type { Quote, QuoteLine } from "./summary";

/**
 * As imagens do documento em PDF, desenhadas em processo e entregues em PNG. É o que permite o PDF levar os
 * mesmos rostos e as mesmas artes da tela, em vez de um substituto: o Adventurer do avatar e o Loops do
 * catálogo já nascem aqui dentro (`@dicebear`, sem rede), e o `sharp`, que o projeto já tem, os rasteriza.
 *
 * O react-pdf só desenha PNG e JPEG, então tudo passa por aqui: o desenho gerado, e também a foto de fora,
 * que assim entra normalizada, sem depender do formato que o outro lado serviu.
 *
 * O recorte é a forma da casa, não um arredondamento qualquer: a máscara é o `squirclePath`, a mesma
 * superelipse que o `corner-shape: squircle` desenha na tela. No PDF não existe `corner-shape`, e o raio do
 * avatar é metade do lado, então sem a máscara o azulejo sairia redondo em vez de quadrado de canto macio.
 */

export type PdfImage = { data: Buffer; format: "png" };

/**
 * Quatro vezes o lado que a imagem ocupa no papel. Em 72 pontos por polegada, quatro vezes é cerca de 300
 * pontos por polegada, a régua de gráfica: acima disso o arquivo engorda sem a vista ganhar nada.
 */
const DENSITY = 4;

/** Quanto a foto de fora tem para chegar antes de o documento seguir com o desenho gerado. */
const FETCH_TIMEOUT = 4000;

/**
 * O anel do fundo da folha em volta da logo da equipe, o `box-shadow: 0 0 0 3px var(--color-bg)` da tela: é
 * ele que separa a logo da aura. No PDF ele é desenhado no próprio arquivo, porque sombra não existe lá; o
 * documento devolve o espaço com margem negativa, já que na tela a sombra não ocupa lugar.
 */
export const LOGO_RING = 3;

/** A cor do anel é a da folha, `--color-bg` no tema claro. */
const RING_COLOR = "#fbfbfc";

/**
 * O azulejo do rosto desenhado, o `color-mix(in oklab, var(--avatar-hue) 32%, var(--color-on-accent))` do
 * avatar já resolvido: o pastel do matiz sobre branco. Opaco nos dois temas na tela, e aqui também, porque o
 * traço do Adventurer é escuro e precisa de fundo claro para aparecer.
 */
const avatarTiles: Record<SysHue, string> = {
  red: "#ffc9bf",
  orange: "#ffdfc1",
  yellow: "#fff0c6",
  green: "#c8efcb",
  mint: "#c6eeea",
  teal: "#c6e6ed",
  cyan: "#c6e5f8",
  blue: "#b9d7ff",
  indigo: "#c4caf6",
  purple: "#e6caf7",
  pink: "#ffc6c7",
  brown: "#e1d6ca",
};

/* O DiceBear entrega o SVG só com `viewBox`, e sem largura o `sharp` o rasteriza no tamanho do próprio
   desenho, que no Loops são 100 pixels. Dizer o tamanho no arquivo faz o traço ser gerado já grande, o que
   sai nítido; ampliar depois não desfaz o serrilhado. */
const sizedSvg = (svg: string, px: number) => svg.replace("<svg", `<svg width="${px}" height="${px}"`);

/** O PNG de um desenho vetorial no tamanho pedido, sem recorte: é o caso da arte da linha, que já é solta. */
async function rasterize(svg: string, px: number): Promise<PdfImage> {
  const data = await sharp(Buffer.from(sizedSvg(svg, px))).png().toBuffer();
  return { data, format: "png" };
}

/**
 * O azulejo quadrado de canto macio: o fundo, a imagem cobrindo o quadrado e a máscara do squircle por
 * cima, na ordem em que o `sharp` aplica as camadas. `dest-in` fica por último de propósito, porque ele
 * recorta o que já está desenhado.
 */
async function squircleTile(image: Sharp, side: number, radius: number, background: string, ring = 0): Promise<PdfImage> {
  const px = side * DENSITY;
  const shape = (size: number, corner: number, fill: string) =>
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><path d="${squirclePath(size, size, corner)}" fill="${fill}"/></svg>`);

  const content = await image.resize(px, px, { fit: "cover" }).png().toBuffer();
  const tile = await sharp({ create: { width: px, height: px, channels: 4, background } })
    .composite([{ input: content }, { input: shape(px, radius * DENSITY, "#ffffff"), blend: "dest-in" }])
    .png()
    .toBuffer();

  if (ring === 0) return { data: tile, format: "png" };

  const outer = (side + ring * 2) * DENSITY;
  const data = await sharp(shape(outer, (radius + ring) * DENSITY, RING_COLOR))
    .composite([{ input: tile, top: ring * DENSITY, left: ring * DENSITY }])
    .png()
    .toBuffer();

  return { data, format: "png" };
}

/** A foto de fora, quando ela chega: sem ela o documento não para, e o rosto desenhado entra no lugar. */
async function fetchImage(url: string) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (!response.ok) return null;
    return sharp(Buffer.from(await response.arrayBuffer()));
  } catch {
    return null;
  }
}

/**
 * O avatar da pessoa ou a logo da equipe, no lado e no raio que o componente da tela usa: a foto quando há,
 * e o rosto desenhado sobre o pastel do matiz do nome quando não há, que é a mesma regra do `Avatar`.
 */
async function avatarTile(name: string, url: string | null, side: number, radius: number, ring = 0): Promise<PdfImage> {
  const photo = url ? await fetchImage(url) : null;
  if (photo) return squircleTile(photo, side, radius, "#ffffff", ring);

  const hue = avatarHue(name) as SysHue;
  const face = sharp(Buffer.from(sizedSvg(avatarSvg(svgToken(name)), side * DENSITY)));
  return squircleTile(face, side, radius, avatarTiles[hue], ring);
}

/* A mesma semente da tela, para o desenho ser o mesmo: o matiz nasce do nome do item e o traço, do id. */
const artworkOf = (line: QuoteLine) => {
  const hue = catalogHueFor(line.name);
  return artworkSvg(hue, svgToken(line.catalogItemId ?? line.id));
};

/** O lado da arte dentro do azulejo do item: os 32 do azulejo menos os 5 de folga de cada lado, no tamanho `sm`. */
const ARTWORK_SIDE = 22;

export type QuotePdfImages = {
  issuer: PdfImage;
  client: PdfImage;
  owner: PdfImage;
  /** O rosto de quem assina em círculo e grande, o selo da assinatura digital (2026-09-10). */
  signature: PdfImage;
  /** A arte de cada linha, pelo id dela. */
  lines: Record<string, PdfImage>;
};

/**
 * O lado do selo da assinatura, em pixels da folha: ele é quadrado **na altura do bloco de texto ao lado**
 * (pedido de 2026-09-10), e a conta é a das quatro linhas do registro na entrelinha apertada — três em
 * `caption2` (11px), o nome em `footnote` (13px) e o respiro de 4px antes da emissora. Na tela quem faz isso
 * é o `stretch` do flex, que mede sozinho; aqui a medida precisa ser escrita, porque o react-pdf não tem
 * `align-self: stretch` nem `aspect-ratio`, e é este número que mantém as duas folhas iguais.
 */
export const SIGNATURE_SEAL = Math.round((11 * 1.2 * 3 + 13 * 1.2 + 4) * 10) / 10;

/** Tudo que o documento desenha, resolvido antes de o PDF começar: o react-pdf monta a página de uma vez. */
export async function quotePdfImages(quote: Quote): Promise<QuotePdfImages> {
  const [issuer, client, owner, signature, lines] = await Promise.all([
    avatarTile(quote.issuer.name, quote.issuer.logoUrl, 52, iconButtonCornerRadius.lg, LOGO_RING),
    avatarTile(quote.client.name, quote.client.avatarUrl, 36, iconButtonCornerRadius.sm),
    avatarTile(quote.owner.name, quote.owner.avatarUrl, 36, iconButtonCornerRadius.sm),
    /* O selo da assinatura é redondo, e não squircle: o raio é metade do lado, o que faz a superelipse do
       `squirclePath` fechar num círculo, como o `Avatar` de forma redonda faz na tela. Sem foto vale o mesmo
       rosto desenhado do avatar, como em todo lugar da casa. */
    avatarTile(quote.owner.name, quote.owner.avatarUrl, SIGNATURE_SEAL, SIGNATURE_SEAL / 2),
    Promise.all(quote.lines.map(async (line) => [line.id, await rasterize(artworkOf(line), ARTWORK_SIDE * DENSITY)] as const)),
  ]);

  return { issuer, client, owner, signature, lines: Object.fromEntries(lines) };
}
