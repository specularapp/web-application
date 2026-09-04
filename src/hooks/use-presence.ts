"use client";

import { useCallback, useEffect, useState, type AnimationEvent } from "react";

export type PresenceState = "open" | "closed";

/* Se o fim da animação não chegar (pai escondido, animação desligada pelo sistema), a camada sai
   mesmo assim depois disso. Maior que a saída mais longa da casa. */
const FALLBACK_MS = 400;

/**
 * Mantém uma camada montada enquanto ela anima a saída. `open` é a intenção; `present` é se ela ainda
 * existe na tela; `state` vai para `data-state` e é o que o CSS lê para escolher entre entrar e sair.
 * O elemento animado recebe `onAnimationEnd`, e só ele: o evento sobe dos filhos, então o handler
 * ignora o que não veio do próprio elemento.
 */
export function usePresence(open: boolean) {
  const [exited, setExited] = useState(!open);
  const [seen, setSeen] = useState(open);

  // Ajuste de estado durante o render, que é o jeito que o React recomenda para reagir a uma prop nova
  // sem efeito: ao abrir, a camada volta a existir no mesmo render, sem quadro em branco.
  if (open !== seen) {
    setSeen(open);
    if (open) setExited(false);
  }

  const present = open || !exited;
  const state: PresenceState = open ? "open" : "closed";

  const onAnimationEnd = useCallback(
    (event: AnimationEvent<HTMLElement>) => {
      if (open || event.target !== event.currentTarget) return;
      setExited(true);
    },
    [open],
  );

  useEffect(() => {
    if (open || exited) return;
    const timer = window.setTimeout(() => setExited(true), FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [open, exited]);

  return { present, state, onAnimationEnd };
}
