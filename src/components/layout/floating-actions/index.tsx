"use client";

import type { Route } from "next";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/** As ações que uma tela pendura na barra flutuante do celular: a principal, com o nome, e a de sair. */
export type FloatingActions = {
  primary: { label: string; loading?: boolean; onClick: () => void };
  cancel: { label: string; href: Route };
};

/* O que a barra desenha: só o que muda a marcação. As funções ficam numa referência, então a tela pode
   registrar a cada render sem fazer o menu inteiro re-renderizar a cada tecla digitada num campo. */
type Shape = { primaryLabel: string; loading: boolean; cancelLabel: string; cancelHref: Route } | null;

type ContextValue = {
  shape: Shape;
  run: () => void;
  register: (actions: FloatingActions | null) => void;
};

const FloatingActionsContext = createContext<ContextValue | null>(null);

function shapeOf(actions: FloatingActions | null): Shape {
  if (!actions) return null;
  return {
    primaryLabel: actions.primary.label,
    loading: actions.primary.loading ?? false,
    cancelLabel: actions.cancel.label,
    cancelHref: actions.cancel.href,
  };
}

function sameShape(a: Shape, b: Shape) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.primaryLabel === b.primaryLabel && a.loading === b.loading && a.cancelLabel === b.cancelLabel && a.cancelHref === b.cancelHref;
}

// Liga uma tela à barra flutuante do celular, que mora no menu lateral e não conhece a página: a tela
// registra as ações e a barra as desenha no lugar da busca, minimizada, sem conflito com o botão do
// menu. Vive na concha, então qualquer tela da aplicação pode usar.
export function FloatingActionsProvider({ children }: { children: ReactNode }) {
  const handlers = useRef<FloatingActions | null>(null);
  const [shape, setShape] = useState<Shape>(null);

  const register = useCallback((actions: FloatingActions | null) => {
    handlers.current = actions;
    const next = shapeOf(actions);
    setShape((current) => (sameShape(current, next) ? current : next));
  }, []);

  const run = useCallback(() => handlers.current?.primary.onClick(), []);

  const value = useMemo(() => ({ shape, run, register }), [shape, run, register]);

  return <FloatingActionsContext.Provider value={value}>{children}</FloatingActionsContext.Provider>;
}

/** O que a barra lê: a forma das ações e o disparo da principal. Nulo fora da concha. */
export function useFloatingActions() {
  const context = useContext(FloatingActionsContext);
  return context ? { shape: context.shape, run: context.run } : { shape: null, run: () => undefined };
}

/** A tela pendura as ações enquanto está montada e as tira ao sair. Fora da concha, não faz nada. */
export function useFloatingActionsRegistration(actions: FloatingActions) {
  const context = useContext(FloatingActionsContext);
  const register = context?.register;

  useEffect(() => {
    register?.(actions);
  });

  useEffect(() => () => register?.(null), [register]);
}
