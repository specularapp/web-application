/**
 * Um UUID v4 feito na tela. O `crypto.randomUUID` só existe em contexto seguro (https ou localhost), e pelo IP
 * da rede local, no celular em desenvolvimento, ele some e derrubava a tela (2026-09-22). O
 * `getRandomValues` existe em qualquer contexto, e dele sai o mesmo formato que o banco aceita.
 */
export function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
