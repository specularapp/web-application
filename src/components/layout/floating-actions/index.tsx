"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/** As ações que uma janela pendura na barra flutuante do celular: a principal, com o nome, e a de sair. */
export type FloatingActions = {
  primary: { label: string; loading?: boolean; disabled?: boolean; onClick: () => void };
  cancel: { label: string; onClick: () => void };
};

/* O que a barra desenha: só o que muda a marcação. As funções ficam numa referência, então a janela pode
   registrar a cada render sem fazer o menu inteiro re-renderizar a cada tecla digitada num campo. */
type Shape = { primaryLabel: string; loading: boolean; disabled: boolean; cancelLabel: string } | null;

type ContextValue = {
  shape: Shape;
  runPrimary: () => void;
  runCancel: () => void;
  register: (actions: FloatingActions | null) => void;
};

const FloatingActionsContext = createContext<ContextValue | null>(null);

function shapeOf(actions: FloatingActions | null): Shape {
  if (!actions) return null;
  return { primaryLabel: actions.primary.label, loading: actions.primary.loading ?? false, disabled: actions.primary.disabled ?? false, cancelLabel: actions.cancel.label };
}

function sameShape(a: Shape, b: Shape) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.primaryLabel === b.primaryLabel && a.loading === b.loading && a.disabled === b.disabled && a.cancelLabel === b.cancelLabel;
}

// Liga uma janela à barra flutuante do celular, que mora no menu lateral e não conhece a tela: a janela
// registra salvar e sair, e a barra troca a busca e o sino por eles, com o botão do menu onde sempre fica.
// Vive na concha, então qualquer tela da aplicação pode usar.
export function FloatingActionsProvider({ children }: { children: ReactNode }) {
  const handlers = useRef<FloatingActions | null>(null);
  const [shape, setShape] = useState<Shape>(null);

  const register = useCallback((actions: FloatingActions | null) => {
    handlers.current = actions;
    const next = shapeOf(actions);
    setShape((current) => (sameShape(current, next) ? current : next));
  }, []);

  // Enquanto há ações a barra sobe para cima das janelas, então o `html` leva a marca e toda bandeja
  // aberta ganha a folga de `--floating-bar-inset` embaixo, pela regra do `Dialog`. Vale para qualquer
  // camada que abra nessa situação, sem cada uma precisar saber da barra.
  useEffect(() => {
    if (!shape) return;
    document.documentElement.dataset.floatingActions = "";
    return () => {
      delete document.documentElement.dataset.floatingActions;
    };
  }, [shape]);

  const runPrimary = useCallback(() => handlers.current?.primary.onClick(), []);
  const runCancel = useCallback(() => handlers.current?.cancel.onClick(), []);

  const value = useMemo(() => ({ shape, runPrimary, runCancel, register }), [shape, runPrimary, runCancel, register]);

  return <FloatingActionsContext.Provider value={value}>{children}</FloatingActionsContext.Provider>;
}

const silent = () => undefined;

/** O que a barra lê: a forma das ações e os disparos. Vazio fora da concha. */
export function useFloatingActions() {
  const context = useContext(FloatingActionsContext);
  return context ? { shape: context.shape, runPrimary: context.runPrimary, runCancel: context.runCancel } : { shape: null, runPrimary: silent, runCancel: silent };
}

/** A janela pendura as ações enquanto está aberta e as tira ao fechar ou sair; nulo é o mesmo que tirar,
 *  para quem fica montado fechado. Fora da concha, não faz nada. */
export function useFloatingActionsRegistration(actions: FloatingActions | null) {
  const context = useContext(FloatingActionsContext);
  const register = context?.register;

  useEffect(() => {
    register?.(actions);
  });

  useEffect(() => () => register?.(null), [register]);
}
