"use client";

import type { Appearance } from "@stripe/stripe-js";
import { useEffect, useState } from "react";

// O Payment Element mora num iframe do Stripe, onde a nossa folha não chega: nem token, nem
// `corner-shape`. O jeito de ele parecer nosso é a Appearance API, e para isso a cor precisa sair
// resolvida em RGB. Os tokens usam `light-dark()`, que `getPropertyValue` devolve cru, então uma
// sonda invisível recebe `color: var(--token)` e o valor computado sai pronto. Mesma técnica do
// `GradientBlinds`, que precisa de RGB para o shader.
const tokens = [
  "--color-bg-tertiary",
  "--color-label",
  "--color-label-secondary",
  "--color-label-tertiary",
  "--color-placeholder",
  "--color-border",
  "--color-danger",
  "--color-brand",
  "--color-fill-quaternary",
] as const;

type TokenName = (typeof tokens)[number];
type Palette = Record<TokenName, string>;

function readPalette(): { palette: Palette; fontFamily: string } {
  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.position = "absolute";
  probe.style.width = "0";
  probe.style.height = "0";
  probe.style.overflow = "hidden";
  document.body.append(probe);

  const computed = getComputedStyle(probe);
  const palette = {} as Palette;

  for (const token of tokens) {
    probe.style.color = `var(${token})`;
    palette[token] = computed.color;
  }

  probe.style.fontFamily = "var(--font-body)";
  const fontFamily = computed.fontFamily;

  probe.remove();
  return { palette, fontFamily };
}

function isDark() {
  const declared = document.documentElement.dataset.theme;
  if (declared === "dark") return true;
  if (declared === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function build(): Appearance {
  const { palette, fontFamily } = readPalette();

  return {
    theme: isDark() ? "night" : "stripe",
    variables: {
      fontFamily,
      fontSizeBase: "16px",
      spacingUnit: "4px",
      // O raio aqui é número puro porque a superelipse não atravessa o iframe. É a única parte da
      // interface fora do sistema de cantos da casa, e é limite do Stripe, não escolha nossa.
      borderRadius: "12px",
      colorPrimary: palette["--color-brand"],
      colorBackground: palette["--color-bg-tertiary"],
      colorText: palette["--color-label"],
      colorTextSecondary: palette["--color-label-secondary"],
      colorTextPlaceholder: palette["--color-placeholder"],
      colorDanger: palette["--color-danger"],
      colorIcon: palette["--color-label-secondary"],
    },
    rules: {
      ".Input": {
        backgroundColor: "transparent",
        border: `1px solid ${palette["--color-border"]}`,
        boxShadow: "none",
      },
      ".Input:focus": {
        border: `1px solid ${palette["--color-label-tertiary"]}`,
        boxShadow: "none",
      },
      ".Input--invalid": { border: `1px solid ${palette["--color-danger"]}` },
      ".Label": { color: palette["--color-label-secondary"], fontWeight: "500" },
      ".Tab": {
        backgroundColor: "transparent",
        border: `1px solid ${palette["--color-border"]}`,
        boxShadow: "none",
      },
      ".Tab--selected": {
        backgroundColor: palette["--color-fill-quaternary"],
        border: `1px solid ${palette["--color-label-tertiary"]}`,
        color: palette["--color-label"],
      },
      ".Error": { color: palette["--color-danger"] },
    },
  };
}

/**
 * A leitura acontece no primeiro render do cliente, e não num efeito, para o formulário não piscar no
 * tema padrão do Stripe antes de receber o nosso. Só o formulário de pagamento usa este hook, e ele
 * nunca é renderizado no servidor: aparece depois de um clique. A guarda de `document` fica de rede.
 */
export function useStripeAppearance() {
  const [appearance, setAppearance] = useState<Appearance | undefined>(() =>
    typeof document === "undefined" ? undefined : build(),
  );

  useEffect(() => {
    const refresh = () => setAppearance(build());
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", refresh);

    return () => {
      observer.disconnect();
      scheme.removeEventListener("change", refresh);
    };
  }, []);

  return appearance;
}
