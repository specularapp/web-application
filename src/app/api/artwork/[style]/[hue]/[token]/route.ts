import { artworkSvg, isArtworkHue } from "@/lib/artwork";
import { cleanSvgToken, isArtworkStyle, svgResponse } from "@/lib/generated-svg";

// A arte gerada de quem não tem foto: o ícone de um item do catálogo e a capa de um projeto, cada um no seu
// estilo do DiceBear, tingido no matiz de quem pediu. O estilo e o matiz vão no caminho e são validados
// contra listas fechadas; o token é o hash do id. O estilo no endereço, e não fixo na rota (2026-09-16), é o
// que deixa dois desenhos diferentes dividirem a mesma moldura sem duas rotas iguais.
//
// Fora do proxy como a rota do avatar: sem sessão nem dado, só um desenho que sai do próprio endereço.
export async function GET(_request: Request, { params }: { params: Promise<{ style: string; hue: string; token: string }> }) {
  const { style, hue, token: segment } = await params;
  const token = cleanSvgToken(segment);
  return svgResponse(token && isArtworkStyle(style) && isArtworkHue(hue) ? artworkSvg(style, hue, token) : null);
}
