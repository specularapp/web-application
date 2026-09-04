"use client";

import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { popIn } from "../styles";

export type DialogSize = "sm" | "md" | "lg";

export type DialogPlacement = "center" | "end";

export type DialogSurface = "solid" | "glass";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  /** Nome da janela para leitor de tela, quando não há título visível dentro. */
  label: string;
  size?: DialogSize;
  /** `end` cola a janela na lateral final da tela, em altura cheia, no lugar de centralizar. */
  placement?: DialogPlacement;
  /** `glass` troca a superfície opaca pelo vidro: quase transparente, com o borrão desenhando a caixa. */
  surface?: DialogSurface;
  /** Sem o fundo que escurece a janela deixa de bloquear o resto e passa a fechar ao tocar fora. */
  scrim?: boolean;
  /** Desligado, o foco para na própria janela: no celular, focar um campo abre o teclado sozinho. */
  focusOnOpen?: boolean;
  children: ReactNode;
  className?: string;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const fade = keyframes`
  from {
    opacity: 0;
  }
`;

const rise = keyframes`
  from {
    transform: translateY(100%);
  }
`;

const slide = keyframes`
  from {
    transform: translateX(100%);
  }
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  background-color: var(--color-scrim);

  /* Véu leve: a bandeja do celular sempre separa a janela da página, mesmo quando a janela dispensa o
     escurecimento cheio. Sem nada atrás dela, ela lia como parte do conteúdo. */
  &[data-soft] {
    background-color: var(--color-scrim-soft);
  }
  animation: ${fade} var(--duration-base) var(--ease-standard);

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

/* A moldura cobre a tela só para posicionar a caixa, e não recebe ponteiro: assim o clique na área
   vazia atravessa e chega no fundo, que é quem fecha. */
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
  --slide: var(--space-2);

  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: min(34rem, calc(100dvh - var(--space-16)));
  min-height: 0;
  overflow: hidden;
  background-color: var(--color-bg-grouped-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-3xl);
  corner-shape: squircle;
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
  animation: ${popIn} var(--duration-base) var(--ease-standard);

  &[data-size="sm"] {
    max-width: 24rem;
  }

  &[data-size="md"] {
    max-width: 30rem;
  }

  &[data-size="lg"] {
    max-width: 40rem;
  }

  &[data-surface="glass"] {
    background-color: var(--glass-bg);
    -webkit-backdrop-filter: var(--glass-blur);
    backdrop-filter: var(--glass-blur);
  }

  /* Gaveta da lateral: altura cheia menos a folga de 8px que a moldura abre, e canto nos quatro
     lados, porque ela não encosta em borda nenhuma. */
  &[data-placement="end"] {
    height: 100%;
    max-height: none;
    border-radius: var(--radius-3xl);
    animation: ${slide} var(--duration-slow) var(--ease-standard);
  }

  &[data-mode="sheet"] {
    height: auto;
    max-width: none;
    max-height: 85dvh;
    padding-block-end: env(safe-area-inset-bottom);
    border-block-start: 1px solid var(--color-border);
    border-block-end: 0;
    border-inline: 0;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    animation: ${rise} var(--duration-slow) var(--ease-standard);
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Handle = styled.span`
  display: block;
  flex-shrink: 0;
  width: 2.25rem;
  height: 0.25rem;
  margin: var(--space-3) auto 0;
  background-color: var(--color-fill);
  border-radius: var(--radius-full);
`;

// Janela da casa: caixa centralizada, gaveta colada na lateral final ou bandeja subindo do rodapé no
// celular, na mesma moldura do calendário. Escape fecha, o Tab dá a volta por dentro e o foco volta
// para quem abriu.
export function Dialog({
  open,
  onClose,
  label,
  size = "md",
  placement = "center",
  surface = "solid",
  scrim = true,
  focusOnOpen = true,
  children,
  className,
}: DialogProps) {
  const sheet = useMediaQuery(MOBILE_QUERY);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    const opener = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";

    // Sem `focusOnOpen` quem recebe o foco é a própria janela, e não o primeiro campo: o Tab continua
    // preso aqui dentro e o teclado do celular não sobe sozinho ao abrir.
    if (focusOnOpen) panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    else panel?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
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

    // Sem o fundo que escurece não há onde clicar para fechar, então quem fecha é o toque fora da caixa.
    const onPointerDown = (event: PointerEvent) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      closeRef.current();
    };

    document.addEventListener("keydown", onKeyDown);
    if (!scrim) document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      root.style.overflow = overflow;
      opener?.focus({ preventScroll: true });
    };
  }, [open, scrim, focusOnOpen]);

  if (!open) return null;

  const mode = sheet ? "sheet" : "window";
  // A bandeja do celular sempre põe alguma coisa atrás de si: cheio quando a janela bloqueia o resto,
  // leve quando ela é avulsa. No desktop, dispensar o escurecimento continua deixando a tela limpa.
  const veil = scrim || sheet;

  return createPortal(
    <>
      {veil && <Backdrop data-soft={scrim ? undefined : ""} onClick={() => onClose()} />}
      <Frame data-mode={mode} data-placement={placement}>
        <Panel
          ref={panelRef}
          role="dialog"
          tabIndex={-1}
          aria-modal={scrim || undefined}
          aria-label={label}
          data-mode={mode}
          data-placement={placement}
          data-size={size}
          data-surface={surface}
          className={className}
        >
          {sheet && <Handle aria-hidden="true" />}
          {children}
        </Panel>
      </Frame>
    </>,
    document.body,
  );
}
