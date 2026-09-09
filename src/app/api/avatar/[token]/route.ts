import { avatarSvg } from "@/components/ui/avatar/shape";
import { cleanSvgToken, svgResponse } from "@/lib/generated-svg";

// O rosto gerado de uma pessoa, endereçado pelo token opaco que `avatarToken` monta. Fora do proxy por
// construção: o matcher dele já pula `/api`, e aqui não há sessão nem dado, só um desenho que sai do
// próprio endereço. Cabeçalhos e cache são os de toda rota de desenho, em `lib/generated-svg.ts`.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = cleanSvgToken((await params).token);
  return svgResponse(token && avatarSvg(token));
}
