import { cookieString } from "./cookies";

export const THEME_COOKIE = "theme";
export const themes = ["light", "dark"] as const;

export type Theme = (typeof themes)[number];
export type ThemePreference = Theme | "system";

const preferences: readonly ThemePreference[] = [...themes, "system"];

/** `system` também é preferência gravada: quem a escolheu não pode ver o padrão escuro voltar na recarga. */
export function readThemeCookie(value: string | undefined): ThemePreference | undefined {
  return preferences.find((preference) => preference === value);
}

export function themeCookieString(preference: ThemePreference) {
  return cookieString(THEME_COOKIE, preference);
}

/**
 * O que o `html` recebe em `data-theme`. Escuro é o padrão do produto, então sem preferência salva é
 * escuro; `system` não põe atributo nenhum, e o `color-scheme: light dark` da raiz segue o aparelho.
 */
export function themeAttribute(preference: ThemePreference | undefined): Theme | undefined {
  if (preference === "system") return undefined;
  return preference ?? "dark";
}

/**
 * Só no cliente: grava a preferência e troca o atributo que o CSS lê. A troca fica para o quadro
 * seguinte, para o botão apertado pintar antes do trabalho pesado, que é a página inteira recalculando
 * cada token `light-dark()`. Onde existe, a transição de visão tira uma foto do estado antigo e faz
 * um fundido curto para o novo: o recálculo acontece atrás da foto, em vez de aparecer como engasgo.
 */
export function applyTheme(preference: ThemePreference) {
  document.cookie = themeCookieString(preference);

  const swap = () => {
    const attribute = themeAttribute(preference);
    if (attribute) document.documentElement.dataset.theme = attribute;
    else delete document.documentElement.dataset.theme;
  };

  window.requestAnimationFrame(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced && typeof document.startViewTransition === "function") {
      document.startViewTransition(swap);
      return;
    }
    swap();
  });
}
