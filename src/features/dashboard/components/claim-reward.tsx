"use client";

import { useCelebration } from "@/components/providers/celebration-provider";
import { ClaimSlider, type ClaimSliderProps } from "./claim-slider";

export type ClaimRewardProps = Omit<ClaimSliderProps, "onClaim">;

const number = new Intl.NumberFormat("pt-BR");

// O arrasto dos pontos do dia com a comemoração ao chegar no fim. O desenho da festa saiu daqui em
// 2026-09-16 e virou a peça `Celebration` da casa, a pedido de que todo feito da aplicação tenha o mesmo
// retorno: aqui ficou só o que é dos pontos, que é o número e o texto.
export function ClaimReward({ points, claimed }: ClaimRewardProps) {
  const { celebrate } = useCelebration();

  return (
    <ClaimSlider
      points={points}
      claimed={claimed}
      onClaim={() =>
        celebrate({
          title: "Pontos recebidos!",
          description: "O bônus de hoje entrou na sua conta e a sequência continua. Volte amanhã para pegar mais.",
          figure: number.format(points),
        })
      }
    />
  );
}
