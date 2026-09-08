"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DetailsDialog } from "@/components/ui/details-dialog";
import type { WeeklyChallenge } from "../summary";

/* A ficha da sequência entra por importação dinâmica (varredura de peso de 2026-09-08): ela leva doze
   funções do date-fns e o calendário inteiro para uma janela que nasce fechada. A `DetailsDialog` não
   renderiza o conteúdo enquanto está fechada, então o pedaço só é buscado no primeiro clique. */
const StreakSheet = dynamic(() => import("./streak-sheet").then((module) => module.StreakSheet));

export type StreakButtonProps = { challenge: WeeklyChallenge };

// O atalho do cabeçalho do bloco de desafio diário: no mesmo contorno pequeno dos outros atalhos, mas em
// vez de levar a uma tela abre a janela com a sequência inteira.
export function StreakButton({ challenge }: StreakButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" radius="md" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Ver sequência
      </Button>
      <DetailsDialog open={open} onClose={() => setOpen(false)} label="Sequência de dias na plataforma" size="md">
        <StreakSheet challenge={challenge} />
      </DetailsDialog>
    </>
  );
}
