import { AVATAR_TOKEN, avatarSvg } from "@/components/ui/avatar/shape";

/* Um ano e imutável: o token é derivado da semente e o desenho é determinístico, então o mesmo endereço
   devolve para sempre o mesmo arquivo. É isto que tira o rosto do HTML: antes cada avatar ia embutido na
   marcação e de novo na carga do RSC, e a mesma pessoa aparecendo em cinco lugares custava cinco vezes. */
const CACHE = "public, max-age=31536000, immutable";

/* O arquivo é servido da nossa origem, então ele ganha a política mais fechada que existe: sem script,
   sem busca, sem nada além do próprio desenho. O conteúdo é gerado pelo DiceBear a partir de um token
   que casa com `[a-z0-9]`, sem texto de usuário dentro, mas o cinto e o suspensório ficam mesmo assim,
   porque SVG na própria origem é vetor de script quando o conteúdo escorrega. */
const HEADERS = {
  "content-type": "image/svg+xml; charset=utf-8",
  "cache-control": CACHE,
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  "x-content-type-options": "nosniff",
};

// O rosto gerado de uma pessoa, endereçado pelo token opaco que `avatarToken` monta. Fora do proxy por
// construção: o matcher dele já pula `/api`, e aqui não há sessão nem dado, só um desenho que sai do
// próprio endereço.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // O `.svg` no fim é só para o navegador e o cache reconhecerem o arquivo pelo que ele é.
  const clean = token.endsWith(".svg") ? token.slice(0, -4) : token;

  if (!AVATAR_TOKEN.test(clean)) return new Response("Token inválido", { status: 400 });

  return new Response(avatarSvg(clean), { headers: HEADERS });
}
