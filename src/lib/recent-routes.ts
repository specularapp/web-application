import { cookieString } from "./cookies";

export const RECENT_COOKIE = "sp-recent";
export const RECENT_LIMIT = 3;

// Preferência de interface, e não dado de sessão: vai em cookie porque Web Storage é proibido pelo
// lint. Guarda só a rota, que já é pública e conhecida pelo menu, nunca o que foi digitado.
export function readRecentRoutes(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(" ")
    .filter((path) => path.startsWith("/"))
    .slice(0, RECENT_LIMIT);
}

export function recentRoutesCookie(paths: string[]) {
  return cookieString(RECENT_COOKIE, paths.slice(0, RECENT_LIMIT).join(" "));
}

export function rememberRoute(current: string[], path: string) {
  return [path, ...current.filter((item) => item !== path)].slice(0, RECENT_LIMIT);
}
