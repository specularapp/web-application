const YEAR = 31_536_000;

export function readCookie(name: string) {
  const entry = document.cookie.split("; ").find((item) => item.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : undefined;
}

// Preferência de interface vai em cookie porque Web Storage é proibido pelo lint. Nunca token, sessão
// nem dado pessoal: para isso existe a sessão do Supabase, que é escrita pelo servidor.
export function cookieString(name: string, value: string, maxAge = YEAR) {
  return `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Secure; Max-Age=${maxAge}`;
}
