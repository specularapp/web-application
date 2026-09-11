"use client";

import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";
import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { isTopLayer, useLayer } from "@/hooks/use-layer";
import { FloatingLayer } from "@/components/layout/floating-actions";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { usePresence } from "@/hooks/use-presence";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { fadeIn, fadeOut, layerMotion } from "../styles";

export type DialogSize = "sm" | "md" | "lg" | "xl";

export type DialogPlacement = "center" | "end";

export type DialogSurface = "solid" | "glass" | "page";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  /** Nome da janela para leitor de tela, quando não há título visível dentro. */
  label: string;
  size?: DialogSize;
  /** `end` cola a janela na lateral final da tela, em altura cheia, no lugar de centralizar. */
  placement?: DialogPlacement;
  /** `glass` troca a superfície opaca pelo vidro: quase transparente, com o borrão desenhando a caixa.
   *  `page` usa o fundo da própria página, e não o cinza elevado: para a gaveta lateral, que é extensão
   *  da tela e não uma caixa sobre ela (a pedido, 2026-09-08, porque no escuro o cinza destoava). */
  surface?: DialogSurface;
  /** Sem o fundo que escurece a página atrás continua à vista, mas segue bloqueada: toda janela é modal, e
   *  tocar fora dela só fecha. */
  scrim?: boolean;
  /** Desligado, o foco para na própria janela: no celular, focar um campo abre o teclado sozinho. */
  focusOnOpen?: boolean;
  /**
   * Uma peça solta **acima** da bandeja do celular, fora da caixa dela (2026-09-11, para o seletor de metade
   * da ficha da tarefa): a bandeja recorta o que passa das bordas, então quem precisa flutuar por cima da
   * página, encostado no topo dela, não pode morar dentro. Só aparece no modo bandeja, que é onde existe
   * espaço acima; na caixa centralizada do desktop não há lugar para ela e ela não é desenhada.
   */
  above?: ReactNode;
  children: ReactNode;
  className?: string;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Teto do quanto o dedo precisa arrastar a alça para baixo para a bandeja fechar. */
const CLOSE_DISTANCE = 120;

const rise = keyframes`
  from {
    opacity: 0;
    transform: translateY(100%);
  }
`;

/* A bandeja desce inteira, sem desbotar: com opacidade junto ela sumia no meio do caminho e a saída lia
   como um corte, não como a bandeja indo embora (2026-09-08). Quem desbota é o fundo. */
const fall = keyframes`
  to {
    transform: translateY(100%);
  }
`;

const slideIn = keyframes`
  from {
    transform: translateX(calc(100% + var(--space-2)));
  }
`;

const slideOut = keyframes`
  to {
    transform: translateX(calc(100% + var(--space-2)));
  }
`;

/* O fundo na mesma camada da moldura: vem antes dela na árvore, então fica atrás da própria janela, e
   uma janela aberta por cima de outra traz o próprio fundo acima da de baixo, para o clique fora chegar
   ao fundo certo. */
const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  background-color: var(--color-scrim);
  animation: ${fadeIn} var(--duration-base) var(--ease-standard) both;

  /* Véu leve: a bandeja do celular sempre separa a janela da página, mesmo quando a janela dispensa o
     escurecimento cheio. Sem nada atrás dela, ela lia como parte do conteúdo. */
  &[data-soft] {
    background-color: var(--color-scrim-soft);
  }

  /* Sob vidro a escuridão vai para a sombra da própria janela, e o fundo fica só para pegar o clique:
     pintada aqui, atrás do vidro, o borrão a puxava para dentro e a janela inteira escurecia junto. */
  &[data-clear] {
    background-color: transparent;
  }

  /* O fundo desbota no mesmo tempo da janela: sumindo antes dela, a janela ainda em movimento ficava solta
     sobre a página e a saída lia como seca. */
  &[data-state="closed"] {
    pointer-events: none;
    animation: ${fadeOut} var(--duration-slow) var(--ease-leave) both;
  }
`;

/* A moldura cobre a tela só para posicionar a caixa, e não recebe ponteiro: assim o clique na área
   vazia atravessa e chega no fundo, que é quem fecha. */
/* O invólucro da peça de cima: fica onde quem a usa mandar, e por isso não pinta nem mede nada. Ela é a
   única coisa clicável fora da bandeja, então o ponteiro volta a valer aqui dentro, porque o `Frame` o
   desliga para o fundo receber o toque de fechar. */
const Above = styled.div`
  position: absolute;
  z-index: 1;
  pointer-events: auto;
`;

const Frame = styled.div`
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: grid;
  place-items: center;
  padding: var(--space-4);
  pointer-events: none;

  &[data-placement="end"] {
    align-items: stretch;
    justify-items: end;
    padding: var(--space-2);
  }

  &[data-mode="sheet"] {
    align-items: end;
    justify-items: stretch;
    padding: 0;
  }
`;

/* Canto declarado direto, sem `data-squircle`: a janela guarda foco e conteúdo que sai do fluxo, e o
   recorte do fallback cortaria o anel de foco de quem está dentro. */
const Panel = styled.div`
  /* A caixa centralizada nasce um degrau abaixo do lugar e sobe; é o "de onde" do gênio quando não há
     gatilho na tela para apontar. */
  --genie-y: var(--space-3);

  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: min(34rem, calc(100dvh - var(--space-16)));
  min-height: 0;
  overflow: hidden;
  /* A rolagem de dentro nunca encadeia para fora: chegando ao fim do conteúdo, o gesto para aqui. */
  overscroll-behavior: contain;
  background-color: var(--color-bg-grouped-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-3xl);
  corner-shape: squircle;
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
  transform-origin: center;

  ${layerMotion};

  &[data-size="sm"] {
    max-width: 24rem;
  }

  &[data-size="md"] {
    max-width: 30rem;
  }

  &[data-size="lg"] {
    max-width: 40rem;
    max-height: min(46rem, calc(100dvh - var(--space-16)));
  }

  /* A janela de trabalho (2026-09-09, para o editor de orçamento): quase a tela inteira, com altura fixa
     para as duas colunas de dentro rolarem por conta própria. Canto 2xl, um degrau abaixo, porque em caixa
     tão grande o 3xl lia como bandeja. */
  &[data-size="xl"] {
    max-width: min(78rem, calc(100vw - var(--space-8)));
    height: calc(100dvh - var(--space-8));
    max-height: none;
    border-radius: var(--radius-2xl);
  }

  &[data-surface="glass"] {
    background-color: var(--glass-layer-bg);
    -webkit-backdrop-filter: var(--glass-layer-blur);
    backdrop-filter: var(--glass-layer-blur);
  }

  /* O fundo da página: o fio continua marcando a borda, e é só ele que separa a gaveta do resto. */
  &[data-surface="page"] {
    background-color: var(--color-bg);
  }

  &[data-mode="sheet"][data-surface="glass"] {
    background-color: var(--glass-sheet-bg);
  }

  /* A escuridão de fora como sombra sem desfoque e com espalhamento maior que a tela: ela cobre tudo
     em volta e nada atrás do vidro, que só borra o que está dentro dos próprios limites. */
  &[data-veil="soft"] {
    box-shadow:
      var(--shadow-lg),
      0 0 0 100vmax var(--color-scrim-soft);
  }

  &[data-veil="full"] {
    box-shadow:
      var(--shadow-lg),
      0 0 0 100vmax var(--color-scrim);
  }

  /* Gaveta da lateral: altura cheia menos a folga de 8px que a moldura abre, e canto nos quatro
     lados, porque ela não encosta em borda nenhuma. Entra e sai deslizando pela lateral. */
  &[data-placement="end"] {
    height: 100%;
    max-height: none;
    border-radius: var(--radius-3xl);
  }

  /* Gaveta e bandeja andam com a curva que assenta, e não com a padrão: elas percorrem distância, e é
     a cauda longa dessa curva que faz a camada parecer pousar em vez de parar de repente. A saída
     segue mais curta que a entrada, porque quem fecha já decidiu. */
  &[data-placement="end"][data-state="open"] {
    animation: ${slideIn} var(--duration-glide) var(--ease-settle) both;
  }

  /* A saída anda em 320ms com a curva de sair: mais curta que a entrada (420), como manda a regra, mas
     com corpo para a gaveta ser vista indo embora em vez de sumir num tranco. */
  &[data-placement="end"][data-state="closed"] {
    animation: ${slideOut} var(--duration-slow) var(--ease-leave) both;
  }

  /* A bandeja vem depois da gaveta de propósito: quando as duas regras casam, no celular, é ela que
     manda, e o painel sobe do rodapé em vez de entrar pela lateral. */
  &[data-mode="sheet"] {
    height: auto;
    max-width: none;
    max-height: 85dvh;
    padding-block-end: env(safe-area-inset-bottom);
    border-block-start: 1px solid var(--color-border);
    border-block-end: 0;
    border-inline: 0;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }

  &[data-mode="sheet"][data-state="open"] {
    animation: ${rise} var(--duration-glide) var(--ease-settle) both;
  }

  &[data-mode="sheet"][data-state="closed"] {
    animation: ${fall} var(--duration-slow) var(--ease-leave) both;
  }

  @media (prefers-reduced-motion: reduce) {
    &[data-placement="end"][data-state="open"],
    &[data-mode="sheet"][data-state="open"] {
      animation: ${fadeIn} var(--duration-fast) linear both;
    }

    &[data-placement="end"][data-state="closed"],
    &[data-mode="sheet"][data-state="closed"] {
      animation: ${fadeOut} var(--duration-fast) linear both;
    }
  }
`;

/* A alça da bandeja é também o puxador: segurar nela e arrastar para baixo fecha a janela. O desenho
   continua sendo a barrinha de 4px, mas quem pega o dedo é a área invisível em volta, na medida de toque
   da casa, porque 4px de altura não se acerta com o polegar. `touch-action: none` para o navegador não
   rolar a página no meio do arrasto. */
const Handle = styled.span`
  position: relative;
  z-index: 1;
  display: block;
  flex-shrink: 0;
  width: 2.25rem;
  height: 0.25rem;
  margin: var(--space-3) auto 0;
  background-color: var(--color-fill);
  border-radius: var(--radius-full);
  touch-action: none;
  cursor: grab;

  &::before {
    content: "";
    position: absolute;
    inset: calc((var(--touch-target) - 0.25rem) / -2) -1.5rem;
  }

  &[data-dragging] {
    cursor: grabbing;
  }
`;

// Janela da casa: caixa centralizada, gaveta colada na lateral final ou bandeja subindo do rodapé no
// celular, na mesma moldura do calendário. Escape fecha, o Tab dá a volta por dentro e o foco volta
// para quem abriu. A janela fica na tela enquanto anima a saída, e só então sai da árvore.
export function Dialog({
  open,
  onClose,
  label,
  size = "md",
  placement = "center",
  surface = "solid",
  scrim = true,
  focusOnOpen = true,
  above,
  children,
  className,
}: DialogProps) {
  const sheet = useMediaQuery(MOBILE_QUERY);
  const { present, state, onAnimationEnd } = usePresence(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const dragRef = useRef<{ pointer: number; startY: number; y: number; frame: number } | null>(null);
  const layer = useLayer(open);
  // Trava a coluna que rola de verdade, e não o documento: na concha da aplicação o documento nunca
  // rola, e mexer no `overflow` dele era o que fazia a página saltar para o topo no celular. Toda janela
  // trava, porque toda janela bloqueia a página atrás (decisão de 2026-09-08).
  useScrollLock(open);
  // Verdadeiro quando esta janela era a camada de cima no instante em que o toque começou. É o que
  // separa uma camada da outra: com o menu de opções aberto por dentro do perfil, o toque que fecha o
  // menu nasce enquanto quem manda é o menu, então o clique que vem depois não fecha o perfil junto.
  const armed = useRef(false);

  useEffect(() => {
    closeRef.current = onClose;
  });

  // Arrasto da alça da bandeja (pedido de 2026-09-08): segurar na barrinha e puxar para baixo fecha a
  // janela, o gesto que o iOS dá em toda bandeja.
  //
  // O painel segue o dedo por `translate`, e não por `transform` (acerto de fluidez de 2026-09-08).
  // São propriedades independentes: as animações de entrada e de saída da bandeja andam em `transform`,
  // então escrever em `translate` não disputa com elas nem obriga o navegador a resolver de novo, a cada
  // quadro, o quadro-chave implícito da animação que está segurando o painel no lugar. Na saída as duas
  // se compõem, e a bandeja desce a partir de onde o dedo largou.
  //
  // A escrita é agrupada num quadro: o ponteiro dispara bem mais de sessenta eventos por segundo, e
  // escrever a cada um deles pedia recálculo de estilo mais vezes do que a tela é capaz de mostrar.
  const dragStart = (event: PointerEvent<HTMLSpanElement>) => {
    const panel = panelRef.current;
    if (!panel) return;
    dragRef.current = { pointer: event.pointerId, startY: event.clientY, y: 0, frame: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = "";
    panel.style.transition = "none";
    // Promove o painel a camada própria antes do primeiro movimento: a bandeja de vidro carrega borrão
    // e uma sombra do tamanho da tela, e sem a promoção o navegador repintaria os dois a cada quadro.
    panel.style.willChange = "translate";
  };

  const dragMove = (event: PointerEvent<HTMLSpanElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || drag.pointer !== event.pointerId || !panel) return;
    // Só para baixo: puxar para cima não estica a bandeja, ela fica onde está.
    drag.y = Math.max(0, event.clientY - drag.startY);
    if (drag.frame) return;
    drag.frame = requestAnimationFrame(() => {
      drag.frame = 0;
      panel.style.translate = `0 ${drag.y}px`;
    });
  };

  const settle = (panel: HTMLDivElement) => {
    panel.style.transition = "";
    panel.style.willChange = "";
  };

  const dragEnd = (event: PointerEvent<HTMLSpanElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || drag.pointer !== event.pointerId || !panel) return;
    if (drag.frame) cancelAnimationFrame(drag.frame);
    dragRef.current = null;
    delete event.currentTarget.dataset.dragging;

    // Fecha passando de um terço da altura da bandeja, com teto: numa bandeja de 85dvh um terço seria
    // quase a tela inteira, e o gesto deixaria de fechar.
    if (drag.y > Math.min(panel.offsetHeight / 3, CLOSE_DISTANCE)) {
      // O `translate` fica onde o dedo largou e a animação de saída, que anda em `transform`, compõe com
      // ele: a bandeja continua descendo daqui em vez de saltar para o lugar antes de cair.
      settle(panel);
      closeRef.current();
      return;
    }

    if (drag.y === 0) {
      settle(panel);
      return;
    }

    // Não passou: volta para o lugar com a transição curta da casa, e as marcas inline saem no fim. O
    // destino é escrito como zero, e não apagado, para a transição ter os dois lados em número.
    panel.style.transition = "translate var(--duration-glide) var(--ease-settle)";
    panel.style.translate = "0 0";
    panel.addEventListener("transitionend", () => settle(panel), { once: true });
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = () => {
      armed.current = isTopLayer(layer);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, layer]);

  useEffect(() => {
    if (!open) return;

    const onTop = () => isTopLayer(layer);

    const panel = panelRef.current;
    const opener = document.activeElement as HTMLElement | null;

    // Sem `focusOnOpen` quem recebe o foco é a própria janela, e não o primeiro campo: o Tab continua
    // preso aqui dentro e o teclado do celular não sobe sozinho ao abrir.
    if (focusOnOpen) panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    else panel?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (!onTop()) return;
      if (event.key === "Escape") {
        closeRef.current();
        return;
      }

      if (event.key !== "Tab" || !panel) return;

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (item) => item.offsetParent !== null,
      );
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus({ preventScroll: true });
    };
  }, [open, focusOnOpen, layer]);

  if (!present) return null;

  const mode = sheet ? "sheet" : "window";
  // O fundo existe sempre, porque toda janela bloqueia a página atrás (decisão de 2026-09-08: com uma
  // janela aberta, a tela de trás nunca responde): cheio com escurecimento, véu leve na bandeja avulsa e
  // transparente na janela avulsa do desktop, que deixa a página à vista sem deixar tocar. É o fundo que
  // fecha ao toque fora, e só quando esta janela era a camada de cima no começo do toque.
  const veilDark = scrim || sheet;
  // Janela de vidro carrega a própria escuridão na sombra; o fundo fica transparente e só pega o clique.
  // O vidro só nas janelas leves (a pedido, 2026-09-08): gaveta lateral e janela grande borram uma área
  // enorme da tela a cada quadro, e no celular e em máquina fraca isso pesava a página inteira. Quem
  // pede vidro numa dessas recebe o sólido, sem precisar saber. A superfície da página passa sempre.
  const heavy = placement === "end" || size === "lg" || size === "xl";
  const glass = surface === "glass" && !heavy;
  const resolvedSurface = glass ? "glass" : surface === "page" ? "page" : "solid";
  const veilKind = veilDark && glass ? (scrim ? "full" : "soft") : undefined;

  return createPortal(
    <>
      {(
        <Backdrop
          data-state={state}
          data-soft={!scrim && sheet ? "" : undefined}
          data-clear={glass || !veilDark ? "" : undefined}
          onClick={() => {
            if (!armed.current) return;
            onClose();
          }}
        />
      )}
      <Frame data-mode={mode} data-placement={placement}>
        {/* A peça que flutua acima da bandeja: sai do fluxo do `Frame` para não virar uma segunda linha da
            grade dele, que empurraria a bandeja para cima. Ela se posiciona sozinha, ancorada no `Frame`,
            que cobre a tela inteira. */}
        {mode === "sheet" && above && <Above>{above}</Above>}
        <Panel
          ref={panelRef}
          role="dialog"
          tabIndex={-1}
          aria-modal
          aria-label={label}
          data-mode={mode}
          data-placement={placement}
          data-size={size}
          data-surface={resolvedSurface}
          data-veil={veilKind}
          data-state={state}
          className={className}
          onAnimationEnd={onAnimationEnd}
        >
          {sheet && (
            <Handle
              aria-hidden="true"
              onPointerDown={dragStart}
              onPointerMove={dragMove}
              onPointerUp={dragEnd}
              onPointerCancel={dragEnd}
            />
          )}
          {/* O conteúdo é uma camada acima de quem abriu esta janela: é assim que a barra flutuante sabe
              que, com uma bandeja aberta por dentro de outra, quem manda nela é a de cima. */}
          <FloatingLayer>{children}</FloatingLayer>
        </Panel>
      </Frame>
    </>,
    document.body,
  );
}
