import { artworkSvg, isCatalogHue } from "@/features/catalog/artwork";
import { cleanSvgToken, svgResponse } from "@/lib/generated-svg";

// A arte gerada de um item do catálogo sem foto, no estilo Loops do DiceBear, com a linha tingida no matiz
// do item. O matiz vai no caminho e é validado contra a lista fechada; o token é o hash do id do item.
// Fora do proxy como a rota do avatar: sem sessão nem dado, só um desenho que sai do próprio endereço.
export async function GET(_request: Request, { params }: { params: Promise<{ hue: string; token: string }> }) {
  const { hue, token: segment } = await params;
  const token = cleanSvgToken(segment);
  return svgResponse(token && isCatalogHue(hue) ? artworkSvg(hue, token) : null);
}
