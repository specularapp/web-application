"use client";

import type { StripeElementStyle } from "@stripe/stripe-js";
import { useEffect, useState } from "react";

// Os campos de cartão moram em iframes do Stripe, onde a nossa folha não chega: nem token, nem
// `corner-shape`. O que atravessa é o objeto `style`, e para isso a cor precisa sair resolvida em
// RGB. Os tokens usam `light-dark()`, que `getPropertyValue` devolve cru, então uma sonda invisível
// recebe `color: var(--token)` e o valor computado sai pronto. Mesma técnica do `GradientBlinds`,
// que precisa de RGB para o shader.
const tokens = ["--color-label", "--color-label-secondary", "--color-placeholder", "--color-danger"] as const;

type TokenName = (typeof tokens)[number];
type Palette = Record<TokenName, string>;

// A fonte do produto entra pelo `next/font`, que serve um arquivo do nosso domínio sem CORS: o
// iframe do Stripe não consegue buscar. Então o Inter chega lá pelo Google Fonts, que é o caminho
// que o Stripe documenta. Falhando, cai no tipo do sistema e só o desenho do dígito muda.
export const cardFontSource = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap";

function readPalette(): Palette {
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

  probe.remove();
  return palette;
}

function build(): StripeElementStyle {
  const palette = readPalette();

  return {
    base: {
      color: palette["--color-label"],
      // Nome literal, e não o do `next/font`: dentro do iframe a família hasheada não existe.
      fontFamily: "Inter, system-ui, sans-serif",
      // Mesmo piso de 16px do `fieldMetrics`: abaixo disso o iOS dá zoom ao focar, e o campo do
      // cartão é um `input` como qualquer outro, só que dentro do iframe.
      fontSize: "16px",
      fontWeight: "400",
      letterSpacing: "-0.02em",
      fontSmoothing: "antialiased",
      iconColor: palette["--color-label-secondary"],
      "::placeholder": { color: palette["--color-placeholder"] },
    },
    invalid: {
      color: palette["--color-danger"],
      iconColor: palette["--color-danger"],
    },
  };
}

/**
 * A leitura acontece no primeiro render do cliente, e não num efeito, para o campo não piscar no
 * estilo padrão do Stripe antes de receber o nosso. Só o formulário de pagamento usa este hook, e
 * ele nunca é renderizado no servidor: aparece depois de um clique. A guarda de `document` fica de
 * rede. Trocar de tema remonta o estilo, e o `react-stripe-js` repassa por `element.update`.
 */
export function useCardStyle() {
  const [style, setStyle] = useState<StripeElementStyle | undefined>(() =>
    typeof document === "undefined" ? undefined : build(),
  );

  useEffect(() => {
    const refresh = () => setStyle(build());
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", refresh);

    return () => {
      observer.disconnect();
      scheme.removeEventListener("change", refresh);
    };
  }, []);

  return style;
}
