"use client";

import { useEffect } from "react";
import { SCROLL_CONTAINER } from "@/lib/scroll";

/**
 * Trava a rolagem de quem está atrás de uma camada aberta.
 *
 * Trava a coluna que rola de verdade, e não o documento (correção de 2026-09-08). Na concha da
 * aplicação o documento nunca rola: `.shell` tem `height: 100dvh` e quem tem `overflow-y: auto` é a
 * coluna de conteúdo. Mexer no `overflow` do `html` ali não travava nada, e ainda causava o pulo que o
 * usuário via de vez em quando no celular: no Safari do iPhone a rolagem do documento é a mesma que o
 * navegador usa para esconder a barra de endereço, então declarar `overflow: hidden` nele com a barra
 * recolhida faz o Safari trazer a barra de volta e zerar esse deslocamento, o que aparece como a página
 * saltando para o topo ao abrir a janela. Era intermitente porque dependia de a barra estar recolhida.
 *
 * Trocar `overflow` de um elemento que rola por dentro, ao contrário, não mexe no `scrollTop` dele nem
 * no visor: a posição fica exatamente onde estava.
 *
 * A contagem é compartilhada porque camada abre de dentro de camada (o menu de opções por dentro do
 * perfil): só a primeira trava e só a última destrava, senão a de cima soltava a rolagem da de baixo.
 */

const frozen: { element: HTMLElement; overflow: string }[] = [];
let depth = 0;

/** Quem rola atrás: a coluna marcada quando existe, e o documento nas telas sem a concha (login, páginas públicas, vitrine). */
function scrollers() {
  const marked = Array.from(document.querySelectorAll<HTMLElement>(`[${SCROLL_CONTAINER}]`));
  return marked.length > 0 ? marked : [document.documentElement];
}

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    depth += 1;
    if (depth === 1) {
      for (const element of scrollers()) {
        frozen.push({ element, overflow: element.style.overflow });
        element.style.overflow = "hidden";
      }
    }

    return () => {
      depth -= 1;
      if (depth > 0) return;
      for (const { element, overflow } of frozen) element.style.overflow = overflow;
      frozen.length = 0;
    };
  }, [active]);
}
