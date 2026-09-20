/**
 * Se o endereço é de um arquivo do nosso armazenamento. É o que separa a imagem que o otimizador do Next
 * pode tratar da que ele recusaria: o otimizador só busca host liberado em `remotePatterns`, e devolve 400
 * em qualquer outro, o que apagaria a imagem da tela.
 *
 * Um `blob:` de prévia também cai fora: ele só existe naquela aba, e o otimizador roda no servidor.
 */
const marker = "/storage/v1/object/public/";

export function isStoredImage(url: string) {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  return Boolean(origin) && url.startsWith(`${origin}${marker}`);
}

/**
 * Um ano de cache no arquivo guardado, em vez da hora que o Storage dá por padrão. O caminho de cada subida
 * leva um identificador aleatório, então o endereço nunca é reaproveitado: trocar a imagem cria um endereço
 * novo e apaga o antigo, e o arquivo que está num endereço é sempre o mesmo. Vale para o navegador de quem
 * usa e para o otimizador do Next, que respeita o maior entre este valor e o `minimumCacheTTL`.
 */
export const STORED_CACHE_CONTROL = "31536000";
