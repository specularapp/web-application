/** Hash curto e estável de um texto, para escolhas determinísticas (frase do dia, matiz de avatar). */
export function hashString(text: string) {
  let value = 0;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}
