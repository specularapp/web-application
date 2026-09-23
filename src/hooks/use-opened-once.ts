"use client";

import { useState } from "react";

/**
 * Verdadeiro desde a primeira vez que algo abriu, e nunca mais falso (2026-09-21, na varredura de peso dos
 * modais). É o par do `dynamic()`: a janela pesada só é montada quando alguém a abre pela primeira vez, e a
 * partir daí fica montada, para a saída continuar animando quando fecha.
 *
 * Sem isto, uma das duas coisas se perde. Montada sempre, o pedaço de código dela desce no primeiro paint
 * da tela, mesmo que ninguém a abra. Desmontada ao fechar, ela desaparece no mesmo quadro e a animação de
 * saída não acontece.
 */
export function useOpenedOnce(open: boolean) {
  const [opened, setOpened] = useState(open);

  /* Ajuste de estado durante o render, como no `usePresence`: abrir monta a janela no mesmo render, sem um
     quadro de espera além do que o próprio carregamento do pedaço já custa. */
  if (open && !opened) setOpened(true);

  return opened;
}
