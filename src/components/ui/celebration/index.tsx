"use client";

import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";
import type { Icon } from "@phosphor-icons/react";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "../button";
import { Dialog } from "../dialog";
import { popIn } from "../styles";
import { Text } from "../text";

/** Para onde a pessoa pode ir da comemoração: uma rota da casa ou uma ação. */
export type CelebrationAction = { label: string; href?: string; onClick?: () => void };

export type CelebrationProps = {
  open: boolean;
  onClose: () => void;
  /** O que aconteceu, em uma linha curta e no passado: "Orçamento enviado". */
  title: string;
  /** O que isso significa e o que vem a seguir, em uma frase. */
  description: string;
  /**
   * O que fica grande no palco. `figure` é um número ou um valor por extenso, quando o feito tem um: os
   * pontos ganhos, o valor recebido. Sem ele entra o glifo no azulejo do matiz.
   */
  figure?: string;
  icon?: Icon;
  /** O matiz da festa: o verde de quem recebeu, o azul de quem enviou. Padrão, o acento da casa. */
  hue?: string;
  /** O caminho que a pessoa costuma querer em seguida; sem ele fica só o fechar. */
  action?: CelebrationAction;
  /** O rótulo de fechar, quando "Continuar" não é o que se diz ali. */
  closeLabel?: string;
  /** Desligado, a janela abre sem papel voando: para o que é bom mas não é festa. */
  confetti?: boolean;
  children?: ReactNode;
};

/* Os papéis do confete: para onde cada um voa a partir do centro, quanto gira, a cor da paleta do sistema e
   a espera antes de sair. Fixos, para a explosão ser a mesma toda vez e não depender de sorte. */
const confettiPieces = [
  { dx: -120, dy: -70, rot: 200, hue: "purple", delay: 0 },
  { dx: 110, dy: -80, rot: -160, hue: "mint", delay: 40 },
  { dx: -70, dy: -110, rot: 120, hue: "orange", delay: 20 },
  { dx: 60, dy: -120, rot: -240, hue: "yellow", delay: 60 },
  { dx: -140, dy: 10, rot: 90, hue: "pink", delay: 80 },
  { dx: 140, dy: 0, rot: -110, hue: "teal", delay: 30 },
  { dx: -100, dy: 60, rot: 260, hue: "yellow", delay: 90 },
  { dx: 100, dy: 70, rot: -200, hue: "purple", delay: 50 },
  { dx: -30, dy: -140, rot: 150, hue: "cyan", delay: 70 },
  { dx: 30, dy: -130, rot: -90, hue: "pink", delay: 10 },
  { dx: -150, dy: -30, rot: 180, hue: "mint", delay: 110 },
  { dx: 150, dy: -40, rot: -140, hue: "orange", delay: 100 },
  { dx: -60, dy: 90, rot: 220, hue: "teal", delay: 120 },
  { dx: 70, dy: 100, rot: -180, hue: "cyan", delay: 130 },
  { dx: -10, dy: 120, rot: 100, hue: "purple", delay: 140 },
  { dx: 20, dy: -60, rot: -60, hue: "yellow", delay: 150 },
];

const burst = keyframes`
  from {
    opacity: 1;
    transform: translate(0, 0) rotate(0deg) scale(0);
  }

  60% {
    opacity: 1;
  }

  to {
    opacity: 0;
    transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(1);
  }
`;

const Sheet = styled.div`
  display: grid;
  gap: var(--space-5);
  padding: var(--space-6) var(--space-5) var(--space-5);
  text-align: center;
`;

/* O palco: só o que é grande no meio, e os papéis saindo do centro por cima dele, uma vez, quando a janela
   abre. A janela só monta aberta, então a explosão não roda escondida nem se repete ao fechar. */
const Stage = styled.div`
  position: relative;
  display: grid;
  place-items: center;
  padding-block: var(--space-8);
`;

const Figure = styled.span`
  font-size: 4rem;
  font-weight: var(--weight-semibold);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-tightest);
  color: var(--color-label);
  animation: ${popIn} var(--duration-slow) var(--ease-spring) both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

/* O glifo do feito num azulejo do matiz da festa, quando não há número para mostrar: é o mesmo azulejo do
   vazio de tela, um degrau maior, para as duas peças que dão notícia lerem como a mesma família. */
const Glyph = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 5rem;
  height: 5rem;
  color: color-mix(in oklab, var(--party-hue) 70%, var(--color-label));
  background-color: light-dark(
    color-mix(in oklab, var(--party-hue) 12%, transparent),
    color-mix(in oklab, var(--party-hue) 20%, transparent)
  );
  border-radius: var(--radius-2xl);
  corner-shape: squircle;
  animation: ${popIn} var(--duration-slow) var(--ease-spring) both;

  & svg {
    width: 2.25rem;
    height: 2.25rem;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Piece = styled.span`
  position: absolute;
  inset-block-start: 50%;
  inset-inline-start: 50%;
  width: 0.625rem;
  height: 0.375rem;
  pointer-events: none;
  background-color: var(--hue);
  border-radius: var(--radius-xs);
  opacity: 0;
  animation: ${burst} 1100ms var(--ease-standard) var(--delay) both;

  &:nth-of-type(odd) {
    width: 0.375rem;
    height: 0.625rem;
  }

  @media (prefers-reduced-motion: reduce) {
    display: none;
  }
`;

const Copy = styled.div`
  display: grid;
  gap: var(--space-1);
`;

const Actions = styled.div`
  display: grid;
  gap: var(--space-2);
`;

/**
 * A comemoração da casa: a janela de vidro com o feito em tamanho grande, o confete nas cores do sistema
 * saindo do centro uma vez, o que aconteceu, o que isso significa e o caminho de seguir.
 *
 * Nasceu como o fim do arrasto de pontos do painel (2026-09-07) e virou peça em 2026-09-16, a pedido, para
 * **todo feito da aplicação** ter o mesmo retorno. Ela não substitui o `Toast`: o toast é o recibo de uma
 * ação comum, que aparece no canto e some sozinho; a comemoração para a tela, e por isso é só para o que a
 * pessoa vai querer contar para alguém. Quem decide qual dos dois usar é `useCelebration`, e a régua está
 * escrita lá.
 */
export function Celebration({
  open,
  onClose,
  title,
  description,
  figure,
  icon: Mark,
  hue = "var(--color-accent)",
  action,
  closeLabel = "Continuar",
  confetti = true,
  children,
}: CelebrationProps) {
  return (
    <Dialog open={open} onClose={onClose} label={title} size="sm" surface="glass">
      <Sheet style={{ "--party-hue": hue } as CSSProperties}>
        <Stage aria-hidden="true">
          {confetti &&
            confettiPieces.map((piece, index) => (
              <Piece
                key={index}
                style={
                  {
                    "--dx": `${piece.dx}px`,
                    "--dy": `${piece.dy}px`,
                    "--rot": `${piece.rot}deg`,
                    "--hue": `var(--sys-${piece.hue})`,
                    "--delay": `${piece.delay}ms`,
                  } as CSSProperties
                }
              />
            ))}
          {figure ? <Figure>{figure}</Figure> : Mark ? <Glyph><Mark weight="bold" /></Glyph> : null}
        </Stage>

        <Copy>
          <Text as="h2" variant="headline" weight="semibold">
            {title}
          </Text>
          <Text variant="footnote" tone="secondary">
            {description}
          </Text>
        </Copy>

        {children}

        {/* O caminho de seguir em cima, em preenchimento cheio, e o fechar embaixo sem caixa: quem comemora
            quer ver o que fez, e quem não quer só fecha. Sem caminho, o fechar assume o preenchimento. */}
        <Actions>
          {action && (
            <Button
              variant="primary"
              size="md"
              radius="md"
              fullWidth
              href={action.href}
              onClick={() => {
                action.onClick?.();
                onClose();
              }}
            >
              {action.label}
            </Button>
          )}
          <Button variant={action ? "ghost" : "primary"} size="md" radius="md" fullWidth onClick={onClose}>
            {closeLabel}
          </Button>
        </Actions>
      </Sheet>
    </Dialog>
  );
}
