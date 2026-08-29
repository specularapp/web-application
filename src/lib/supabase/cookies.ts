import type { CookieOptions } from "@supabase/ssr";

export const REMEMBER_COOKIE = "sp-remember";

const ONE_YEAR = 60 * 60 * 24 * 365;

export function rememberCookie(remember: boolean): CookieOptions {
  return { path: "/", sameSite: "lax", secure: true, ...(remember && { maxAge: ONE_YEAR }) };
}

export function isPersistent(value: string | undefined) {
  return value !== "0";
}

export function scopeToSession(options: CookieOptions, persistent: boolean): CookieOptions {
  if (persistent) return options;
  const { maxAge: _maxAge, expires: _expires, ...session } = options;
  return session;
}
