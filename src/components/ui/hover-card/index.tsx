"use client";

import styled from "@emotion/styled";
import type { Icon } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAnchoredPosition } from "@/hooks/use-anchored-position";
import { usePresence } from "@/hooks/use-presence";
import { layerMotion } from "../styles";
import { Text } from "../text";

export type HoverCardProps = {
  /** O que a caixa mostra: a ficha resumida de quem está no gatilho. */
  content: ReactNode;
  /** O gatilho: o que a pessoa aponta para a ficha resumida aparecer. */
  children: ReactNode;
  /** Largura da caixa em pixels, para ela não passar da borda da janela. */
  width?: number;
  /** Altura estimada em pixels, para a caixa escolher abrir para cima quando não cabe embaixo. */
  height?: number;
/** O gatilho abre e fecha no clique, e deixa de abrir ao apontar: é o botão de informação, que serve ao dedo
   *  e não pisca em quem só passa o ponteiro por cima (pedido de 2026-09-09). */
  openOnClick?: boolean;
  /** Só num gatilho que é botão: o invólucro deixa de ser bloco e vira linha, para não empurrar o vizinho. */
  inline?: boolean;
  /**
   * O tema em que a caixa desenha, quando ela flutua sobre uma superfície de tema fixo. O documento do
   * orçamento é sempre claro, em qualquer tema: a caixa portada para o corpo da página herdaria o tema de
   * lá, e o vidro escuro sobre papel branco vira um borrão cinza, sem fio e sem sombra que se veja (relato
   * de 2026-09-09). Dizendo o tema, ela é vidro claro sobre papel claro, como em toda a casa.
   */
  scheme?: "light" | "dark";
};

const WIDTH = 320;
const HEIGHT = 300;
const EDGE = 16;
const GAP = 8;
/* A demora de abrir é o que separa apontar de passar por cima; a de fechar deixa o ponteiro cruzar o vão
   até a caixa sem ela sumir no caminho. */
const OPEN_DELAY = 350;
const CLOSE_DELAY = 120;

// A ficha resumida de um item de lista, na camada de vidro da casa (2026-09-08, nascida no catálogo e
// compartilhada com a base de clientes): quem aponta o nome com o mouse vê, depois de uma demora, uma caixa
// com o essencial, sem abrir a ficha inteira. Só o mouse abre: no dedo não há apontar, e o toque na linha já
// abre a ficha. Segue aberta enquanto o ponteiro está nela, para dar para ler. Posiciona no gatilho pela
// mesma receita do menu e anima com o gênio das camadas. O conteúdo é de quem chama, montado com as peças
// deste módulo: cabeça, nomes, etiquetas, fatos com ícone, fio e o texto em duas linhas. Com `openOnClick`
// ela troca o apontar pelo clique e fecha no toque fora, que é o que faz dela um botão de informação.
export function HoverCard({ content, children, width = WIDTH, height = HEIGHT, openOnClick = false, inline = false, scheme }: HoverCardProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const { present, state, onAnimationEnd } = usePresence(open);
  const position = useAnchoredPosition(open, triggerRef, { width, height, edge: EDGE, gap: GAP });

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const schedule = (next: boolean, delay: number) => {
    clear();
    timer.current = window.setTimeout(() => setOpen(next), delay);
  };

  useEffect(() => clear, []);

  const onEnter = (event: PointerEvent<HTMLElement>) => {
    if (openOnClick || event.pointerType !== "mouse") return;
    schedule(true, OPEN_DELAY);
  };

  const onLeave = () => {
    if (openOnClick) return;
    schedule(false, CLOSE_DELAY);
  };

  // Abrindo no clique, o toque fora fecha: sem isso, no dedo a caixa ficaria presa na tela, porque não há
  // ponteiro para sair de cima dela.
  useEffect(() => {
    if (!openOnClick || !open) return;
    const onPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || cardRef.current?.contains(target)) return;
      clear();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openOnClick, open]);

  return (
    <Trigger
      ref={triggerRef}
      data-inline={inline || undefined}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onClick={
        openOnClick
          ? () => {
              clear();
              setOpen((state) => !state);
            }
          : undefined
      }
    >
      {children}
      {present &&
        createPortal(
          <Card
            ref={cardRef}
            role="tooltip"
            data-scheme={scheme}
            data-state={state}
            data-placement={position?.placement ?? "below"}
            style={position ? { top: position.top, left: position.left, width: `min(${width}px, calc(100vw - ${EDGE * 2}px))` } : { visibility: "hidden" }}
            onAnimationEnd={onAnimationEnd}
            onPointerEnter={clear}
            onPointerLeave={onLeave}
          >
            {content}
          </Card>,
          document.body,
        )}
    </Trigger>
  );
}

/** Um fato da ficha resumida: o ícone na tinta secundária e o texto numa linha só. */
export function HoverCardFact({ icon: Glyph, children }: { icon: Icon; children: ReactNode }) {
  return (
    <FactRow>
      <Glyph aria-hidden="true" />
      <Text as="span" variant="footnote" truncate>
        {children}
      </Text>
    </FactRow>
  );
}

const Trigger = styled.span`
  display: block;
  min-width: 0;

  &[data-inline] {
    display: inline-flex;
  }
`;

/* A camada de vidro da casa, a mesma dos menus: fundo a 20% com borrão, fio fino, sombra e o gênio. O canto
   é `xl`, bem abaixo da metade da altura. */
const Card = styled.div`
  --genie-y: calc(var(--space-2) * -1);

  position: fixed;
  z-index: var(--z-popover);
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  background-color: var(--glass-layer-bg);
  border: 0.0375rem solid var(--color-border);
  border-radius: var(--radius-xl);
  corner-shape: squircle;
  box-shadow: var(--shadow-lg);
  -webkit-backdrop-filter: var(--glass-layer-blur);
  backdrop-filter: var(--glass-layer-blur);
  transform-origin: top left;

  ${layerMotion};

  &[data-placement="above"] {
    --genie-y: var(--space-2);
    transform-origin: bottom left;
    translate: 0 -100%;
  }
`;

/** A cabeça: a foto ou a arte e os nomes ao lado. */
export const HoverCardHead = styled.div`
  display: flex;
  gap: var(--space-3);
  align-items: center;
  min-width: 0;
`;

export const HoverCardNaming = styled.span`
  display: grid;
  flex: 1;
  gap: var(--space-half);
  min-width: 0;
`;

export const HoverCardTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
`;

export const HoverCardFacts = styled.div`
  display: grid;
  gap: var(--space-2);
`;

const FactRow = styled.div`
  display: flex;
  gap: var(--space-2);
  align-items: center;
  min-width: 0;

  & > svg {
    flex-shrink: 0;
    width: 1rem;
    height: 1rem;
    color: var(--color-label-secondary);
  }
`;

export const HoverCardRule = styled.hr`
  height: 0.0375rem;
  margin: 0;
  background-color: var(--color-border);
  border: 0;
`;

/** Texto corrido em até duas linhas, para a descrição ou a anotação. */
export const HoverCardClamp = styled(Text)`
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
`;
