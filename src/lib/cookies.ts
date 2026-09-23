const YEAR = 31_536_000;

/** No servidor não há documento: devolve vazio em vez de derrubar o render de quem lê cookie no estado inicial. */
export function readCookie(name: string) {
  if (typeof document === "undefined") return undefined;
  const entry = document.cookie.split("; ").find((item) => item.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : undefined;
}

// Preferência de interface vai em cookie porque Web Storage é proibido pelo lint. Nunca token, sessão
// nem dado pessoal: para isso existe a sessão do Supabase, que é escrita pelo servidor.
// `Secure` só onde a página é https: pelo IP da rede local, no celular em desenvolvimento, o navegador recusa
// cookie seguro em http, e nenhuma preferência ficava guardada. Em produção tudo é https, e nada muda.
export function cookieString(name: string, value: string, maxAge = YEAR) {
  const secure = typeof location === "undefined" || location.protocol === "https:" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${secure}; Max-Age=${maxAge}`;
}
