"use client";

import { useEffect, type RefObject } from "react";

/**
 * Fecha uma camada ao apontar fora dela e engole o clique que vem em seguida: quem clica fora quer só
 * fechar, e o botão que estava embaixo do ponteiro não pode disparar junto. O ouvinte do clique entra
 * na captura do documento, antes do React, e sai sozinho um pouco depois do pointerup (no toque o clique
 * pode chegar bem depois do dedo sair; solto no tique seguinte, ele vazava e fechava a janela de baixo
 * junto com o menu), então um toque sem clique (arraste, cancelamento) não deixa nada engolido para trás.
 */
/** Quanto o engolidor espera pelo clique depois do dedo sair. */
const CLICK_GRACE = 400;

export function useOutsideDismiss(active: boolean, inside: RefObject<HTMLElement | null>[], onDismiss: () => void) {
  useEffect(() => {
    if (!active) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (inside.some((ref) => ref.current?.contains(target))) return;
      onDismiss();

      const swallow = (click: MouseEvent) => {
        click.preventDefault();
        click.stopPropagation();
      };
      const release = () => {
        window.setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), CLICK_GRACE);
      };

      document.addEventListener("click", swallow, { capture: true, once: true });
      document.addEventListener("pointerup", release, { once: true });
      document.addEventListener("pointercancel", release, { once: true });
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [active, inside, onDismiss]);
}
