"use client";

import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";
import { useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { popIn } from "@/components/ui/styles";
import { Text } from "@/components/ui/text";
import { ClaimSlider, type ClaimSliderProps } from "./claim-slider";

export type ClaimRewardProps = Omit<ClaimSliderProps, "onClaim">;

const number = new Intl.NumberFormat("pt-BR");

/* Os papéis do confete: para onde cada um voa a partir do centro, quanto gira, a cor da paleta do
   sistema e a espera antes de sair. Fixos, para a explosão ser a mesma toda vez e não depender de sorte. */
const confetti = [
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

/* O palco da explosão: só o número grande no meio, e os papéis saindo do centro por cima dele, uma vez,
   quando a janela abre. */
const Stage = styled.div`
  position: relative;
  display: grid;
  place-items: center;
  padding-block: var(--space-8);
`;

const Points = styled.span`
  --slide: 12px;
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

// O arrasto dos pontos do dia com a comemoração ao chegar no fim: a janela de vidro da casa abre com os
// pontos ganhos em número grande, o confete nas cores do sistema saindo do
// centro uma vez, e um botão para seguir. Fechar é o único caminho de volta; os pontos já entraram.
export function ClaimReward({ points, claimed }: ClaimRewardProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ClaimSlider points={points} claimed={claimed} onClaim={() => setOpen(true)} />

      <Dialog open={open} onClose={() => setOpen(false)} label="Pontos recebidos" size="sm" surface="glass">
        <Sheet>
          <Stage aria-hidden="true">
            {confetti.map((piece, index) => (
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
            <Points>+{number.format(points)}</Points>
          </Stage>

          <Copy>
            <Text as="h2" variant="headline" weight="semibold">
              Pontos recebidos!
            </Text>
            <Text variant="footnote" tone="secondary">
              O bônus de hoje entrou na sua conta e a sequência continua. Volte amanhã para pegar mais.
            </Text>
          </Copy>

          <Button variant="primary" size="md" fullWidth onClick={() => setOpen(false)}>
            Continuar
          </Button>
        </Sheet>
      </Dialog>
    </>
  );
}
