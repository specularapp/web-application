/**
 * O que toda rota de desenho gerado compartilha: o token que endereça uma semente, o formato que a rota
 * aceita, o cache por token e os cabeçalhos do arquivo. O rosto do avatar (`components/ui/avatar/shape.ts`)
 * e a arte do catálogo (`features/catalog/artwork.ts`) desenham coisas diferentes com a mesma moldura.
 * Puro e sem DOM, então serve ao servidor, que desenha, e ao cliente, que só monta o endereço.
 */

/**
 * O token que endereça o desenho de uma semente, e que é também a semente do desenho.
 *
 * É ele que vai para a URL, e não a semente original, porque a semente costuma ser dado da pessoa
 * (o e-mail no avatar, o id no catálogo): dado em endereço de imagem vaza para registro de acesso, para o
 * cache da borda, para o `Referer` e para o histórico do navegador.
 *
 * Duas passagens de hash com multiplicadores diferentes dão cerca de 64 bits, o bastante para dois
 * desenhos não colidirem numa base de milhares. É determinístico e sem estado: a mesma semente dá sempre
 * o mesmo token, e o token sozinho basta para redesenhar, então a rota não precisa guardar mapa nenhum.
 */
export function svgToken(seed: string) {
  let a = 0;
  let b = 0;
  for (const char of seed) {
    const code = char.charCodeAt(0);
    a = (a * 31 + code) >>> 0;
    b = (b * 131 + code + 7) >>> 0;
  }
  return `${a.toString(36)}${b.toString(36).padStart(7, "0")}`;
}

/** Formato que as rotas aceitam: só o que `svgToken` produz, para nada além de token virar desenho. */
export const SVG_TOKEN = /^[a-z0-9]{1,24}$/;

/** O segmento da URL sem o `.svg`, que é só para o navegador e o cache reconhecerem o arquivo; nulo quando não é token. */
export function cleanSvgToken(segment: string) {
  const token = segment.endsWith(".svg") ? segment.slice(0, -4) : segment;
  return SVG_TOKEN.test(token) ? token : null;
}

/** O `<metadata>` do DiceBear sai para não pesar: é licença e crédito repetidos em todo arquivo. */
export const stripSvgMetadata = (svg: string) => svg.replace(/<metadata[\s\S]*?<\/metadata>/, "");

/**
 * Desenhar custa CPU, e a mesma chave volta a cada carga da página e a cada pessoa que a abre. O SVG
 * pronto fica em cache por chave, com teto para não crescer sem fim num processo longo. Do lado de fora
 * quem guarda é o cabeçalho de cache da rota, por um ano.
 */
export function memoizeSvg(render: (key: string) => string, limit = 200) {
  const cache = new Map<string, string>();
  return (key: string) => {
    const cached = cache.get(key);
    if (cached) return cached;
    const svg = render(key);
    if (cache.size >= limit) cache.clear();
    cache.set(key, svg);
    return svg;
  };
}

/* Um ano e imutável: o token é derivado da semente e o desenho é determinístico, então o mesmo endereço
   devolve para sempre o mesmo arquivo. É isto que tira o desenho do HTML: embutido, ele ia na marcação e
   de novo na carga do RSC, e o mesmo desenho em cinco lugares custava cinco vezes. */
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

/** A resposta de uma rota de desenho: o arquivo com os cabeçalhos da casa, ou 400 quando o pedido não é token. */
export function svgResponse(svg: string | null) {
  if (svg === null) return new Response("Token inválido", { status: 400 });
  return new Response(svg, { headers: HEADERS });
}
