import * as adventurer from "@dicebear/adventurer";
import { createAvatar } from "@dicebear/core";

const MASK_ID = "viewboxMask";
const CACHE_LIMIT = 200;

/* Desenhar o rosto custa CPU, e o mesmo token volta a cada carga da página e a cada pessoa que a abre.
   O SVG pronto fica em cache por token, com teto para não crescer sem fim num processo longo. Do lado
   de fora quem guarda é o cabeçalho de cache da rota, por um ano. */
const cache = new Map<string, string>();

/**
 * O token que endereça o rosto de uma semente, e que é também a semente do desenho.
 *
 * É ele que vai para a URL, e não a semente original, porque a semente costuma ser o e-mail da pessoa
 * (`seed={client.email}`, para o rosto não mudar quando o nome muda): e-mail em endereço de imagem vaza
 * para registro de acesso, para o cache da borda, para o `Referer` e para o histórico do navegador, e
 * dado de cliente é justamente o que este produto promete guardar.
 *
 * Duas passagens de hash com multiplicadores diferentes dão cerca de 64 bits, o bastante para dois
 * rostos não colidirem numa base de milhares de pessoas. É determinístico e sem estado: a mesma semente
 * dá sempre o mesmo token, e o token sozinho basta para redesenhar, então a rota não precisa guardar
 * mapa nenhum.
 */
export function avatarToken(seed: string) {
  let a = 0;
  let b = 0;
  for (const char of seed) {
    const code = char.charCodeAt(0);
    a = (a * 31 + code) >>> 0;
    b = (b * 131 + code + 7) >>> 0;
  }
  return `${a.toString(36)}${b.toString(36).padStart(7, "0")}`;
}

/** Formato que a rota aceita: só o que `avatarToken` produz, para nada além de token virar desenho. */
export const AVATAR_TOKEN = /^[a-z0-9]{1,24}$/;

/**
 * O rosto do Adventurer desenhado a partir do token. SVG gerado em código, sem DOM e sem folha
 * injetada. O `<metadata>` sai para não pesar, e o único `id` do arquivo leva o token, o que o mantém
 * único caso o desenho volte a ser embutido algum dia.
 */
export function avatarSvg(token: string) {
  const cached = cache.get(token);
  if (cached) return cached;

  const svg = createAvatar(adventurer, { seed: token })
    .toString()
    .replace(/<metadata[\s\S]*?<\/metadata>/, "")
    .replaceAll(MASK_ID, `sp-${token}`);

  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(token, svg);
  return svg;
}
