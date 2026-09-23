"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Celebration, type CelebrationProps } from "@/components/ui/celebration";

export type CelebrationOptions = Omit<CelebrationProps, "open" | "onClose">;

type CelebrationContextValue = {
  /** Mostra o retorno principal. Uma por vez, para cada ação ter uma mensagem clara. */
  celebrate: (options: CelebrationOptions) => void;
  close: () => void;
};

const CelebrationContext = createContext<CelebrationContextValue | null>(null);

/**
 * De onde qualquer tela chama a comemoração da casa, como `useToast` faz com o recibo. Mora na raiz, ao lado
 * do provedor de toast, porque quem comemora está no meio de um formulário ou de uma janela e não tem como
 * montar uma janela por cima de tudo por conta própria.
 *
 * A camada de toast promove resultados bem sucedidos para esta janela e mantém avisos e erros no canto.
 * O confete continua opcional: o mesmo retorno atende tanto uma edição discreta quanto um marco maior.
 */
export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [party, setParty] = useState<CelebrationOptions | null>(null);

  const celebrate = useCallback((options: CelebrationOptions) => setParty(options), []);
  const close = useCallback(() => setParty(null), []);

  const value = useMemo(() => ({ celebrate, close }), [celebrate, close]);

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      {/* Só monta quando há retorno: assim a entrada acontece no momento exato da ação. */}
      {party && <Celebration open onClose={close} {...party} />}
    </CelebrationContext.Provider>
  );
}

export function useCelebration() {
  const context = useContext(CelebrationContext);
  if (!context) throw new Error("useCelebration precisa estar dentro de CelebrationProvider");
  return context;
}
