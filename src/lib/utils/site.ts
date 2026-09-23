/**
 * O endereço de um site, nas duas direções: o que o campo mostra e o que o banco guarda.
 *
 * O campo tem o `https://` escrito à esquerda, em tinta apagada, então o que a pessoa digita é o resto. Só
 * que ela cola o endereço inteiro, que é o que se copia da barra do navegador, e aí o protocolo entrava duas
 * vezes: uma na etiqueta e outra no valor. Pior, ao salvar o valor era concatenado com `https://` de novo, e
 * o banco terminava com `https://https://algo.com` (2026-09-16, relatado com a tela na mão).
 *
 * Por isso a limpeza tira **todos** os protocolos do começo, e não um: a base já tem endereços dobrados, e
 * tirar um só deixava o outro à vista. Com isto, abrir e salvar a ficha conserta o que estava torto.
 */

/* Um ou mais protocolos no começo, com ou sem `//`, seguidos de espaço nenhum ou algum. */
const PROTOCOL = /^(?:\s*(?:https?:)?\/\/)+/i;
const NAKED_PROTOCOL = /^(?:\s*https?:\s*\/*)+/i;

/** O que o campo mostra: o endereço sem protocolo nenhum e sem espaço nas pontas. */
export function siteValue(raw: string) {
  return raw.replace(NAKED_PROTOCOL, "").replace(PROTOCOL, "").trim();
}

/** O que o banco guarda: o endereço com um protocolo só, ou vazio quando não há endereço. */
export function siteUrl(raw: string) {
  const clean = siteValue(raw);
  return clean ? `https://${clean}` : "";
}

/**
 * Só o domínio do endereço, sem protocolo nem "www": é o que cabe na linha de um cartão ou de uma ficha.
 *
 * A guarda não é zelo: um endereço sem protocolo faz `new URL` lançar, e num Server Component isso derruba a
 * tela inteira, não só a linha do site (2026-09-22, na varredura). Existia copiada em projetos, em contratos
 * e, sem a guarda, na ficha do cliente.
 */
export function siteLabel(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return siteValue(url) || url;
  }
}

/** Verdadeiro para endereço absoluto em http ou https, que é o único que a casa guarda. */
export function isSiteUrl(value: string) {
  if (!URL.canParse(value)) return false;
  const { protocol } = new URL(value);
  return protocol === "http:" || protocol === "https:";
}
