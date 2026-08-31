import type { CookieOptions } from "@supabase/ssr";

export const REMEMBER_COOKIE = "sp-remember";

const ONE_YEAR = 60 * 60 * 24 * 365;

export function rememberCookie(remember: boolean): CookieOptions {
  return { path: "/", sameSite: "lax", secure: true, ...(remember && { maxAge: ONE_YEAR }) };
}

export function isPersistent(value: string | undefined) {
  return value !== "0";
}

// maxAge zero é como o @supabase/ssr apaga cookie: tirar junto com a persistência deixaria
// o cookie vazio no navegador em vez de removido ao sair.
export function scopeToSession(options: CookieOptions, persistent: boolean): CookieOptions {
  if (persistent || options.maxAge === 0) return options;
  const { maxAge: _maxAge, expires: _expires, ...session } = options;
  return session;
}

export const sessionCookieOptions: CookieOptions = {
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
};
