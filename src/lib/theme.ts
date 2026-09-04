export const THEME_COOKIE = "theme";
export const themes = ["light", "dark"] as const;

export type Theme = (typeof themes)[number];
export type ThemePreference = Theme | "system";

export function readThemeCookie(value: string | undefined): Theme | undefined {
  return themes.find((theme) => theme === value);
}

export function themeCookieString(preference: ThemePreference) {
  const base = `${THEME_COOKIE}=; Path=/; SameSite=Lax; Secure`;
  if (preference === "system") return `${base}; Max-Age=0`;
  return `${THEME_COOKIE}=${preference}; Path=/; SameSite=Lax; Secure; Max-Age=31536000`;
}

/** Só no cliente: grava a preferência e liga o atributo que o CSS lê. */
export function applyTheme(preference: ThemePreference) {
  document.cookie = themeCookieString(preference);
  if (preference === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = preference;
}
