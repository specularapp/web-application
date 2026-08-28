const MAX_LENGTH = 512;
const FALLBACK = "/dashboard";

// Controle, espaco e tabulacao: o navegador remove ao normalizar a URL,
// entao um caractere de controle no meio pode virar "//evil.com" depois do parse.
const UNSAFE_CHARS = /[\u0000-\u0020\u007f]/;

export function isSafePath(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > MAX_LENGTH) return false;
  if (UNSAFE_CHARS.test(value)) return false;

  if (!value.startsWith("/")) return false;

  // "//evil.com" e "/\evil.com" viram protocol-relative no navegador
  if (value.startsWith("//")) return false;
  if (value.includes("\\")) return false;

  return true;
}

export function safePath(value: unknown, fallback: string = FALLBACK) {
  return isSafePath(value) ? value : fallback;
}
