"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/** As ações que uma janela pendura na barra flutuante do celular: a principal, com o nome, e a de sair. */
export type FloatingActions = {
  primary: { label: string; loading?: boolean; disabled?: boolean; onClick: () => void };
  cancel: { label: string; onClick: () => void };
};

/** A paginação que uma lista pendura na barra flutuante do celular, no lugar da busca e do sino. */
export type FloatingPager = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Nome do grupo para leitor de tela, como "Páginas do catálogo". */
  label: string;
};

/* O que a barra desenha: só o que muda a marcação. As funções ficam numa referência, então a janela pode
   registrar a cada render sem fazer o menu inteiro re-renderizar a cada tecla digitada num campo. */
type Shape = { primaryLabel: string; loading: boolean; disabled: boolean; cancelLabel: string } | null;

/* O mesmo para a paginação: página, total e nome mudam a marcação; o disparo fica na referência. */
type PagerShape = { page: number; pageCount: number; label: string } | null;

type ContextValue = {
  shape: Shape;
  pager: PagerShape;
  runPrimary: () => void;
  runCancel: () => void;
  goToPage: (page: number) => void;
  register: (actions: FloatingActions | null) => void;
  registerPager: (pager: FloatingPager | null) => void;
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

function pagerShapeOf(pager: FloatingPager | null): PagerShape {
  if (!pager) return null;
  return { page: pager.page, pageCount: pager.pageCount, label: pager.label };
}

function samePagerShape(a: PagerShape, b: PagerShape) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.page === b.page && a.pageCount === b.pageCount && a.label === b.label;
}

// Liga uma janela ou uma lista à barra flutuante do celular, que mora no menu lateral e não conhece a
// tela: a janela registra salvar e sair, a lista registra a paginação, e a barra troca a busca e o sino
// por eles, com o botão do menu onde sempre fica. Janela manda na lista: com um formulário aberto, quem
// aparece é salvar e sair. Vive na concha, então qualquer tela da aplicação pode usar.
export function FloatingActionsProvider({ children }: { children: ReactNode }) {
  const handlers = useRef<FloatingActions | null>(null);
  const pagerHandlers = useRef<FloatingPager | null>(null);
  const [shape, setShape] = useState<Shape>(null);
  const [pager, setPager] = useState<PagerShape>(null);

  const register = useCallback((actions: FloatingActions | null) => {
    handlers.current = actions;
    const next = shapeOf(actions);
    setShape((current) => (sameShape(current, next) ? current : next));
  }, []);

  const registerPager = useCallback((next: FloatingPager | null) => {
    pagerHandlers.current = next;
    const shaped = pagerShapeOf(next);
    setPager((current) => (samePagerShape(current, shaped) ? current : shaped));
  }, []);

  // Enquanto há ações a barra sobe para cima das janelas, então o `html` leva a marca e toda bandeja
  // aberta ganha a folga de `--floating-bar-inset` embaixo, pela regra do `Dialog`. Vale para qualquer
  // camada que abra nessa situação, sem cada uma precisar saber da barra. A paginação não sobe: ela é da
  // lista, e some assim que uma janela abre.
  useEffect(() => {
    if (!shape) return;
    document.documentElement.dataset.floatingActions = "";
    return () => {
      delete document.documentElement.dataset.floatingActions;
    };
  }, [shape]);

  const runPrimary = useCallback(() => handlers.current?.primary.onClick(), []);
  const runCancel = useCallback(() => handlers.current?.cancel.onClick(), []);
  const goToPage = useCallback((page: number) => pagerHandlers.current?.onPageChange(page), []);

  const value = useMemo(
    () => ({ shape, pager, runPrimary, runCancel, goToPage, register, registerPager }),
    [shape, pager, runPrimary, runCancel, goToPage, register, registerPager],
  );

  return <FloatingActionsContext.Provider value={value}>{children}</FloatingActionsContext.Provider>;
}

const silent = () => undefined;

/** O que a barra lê: a forma das ações e da paginação, e os disparos. Vazio fora da concha. */
export function useFloatingActions() {
  const context = useContext(FloatingActionsContext);
  if (!context) return { shape: null, pager: null, runPrimary: silent, runCancel: silent, goToPage: silent };
  return { shape: context.shape, pager: context.pager, runPrimary: context.runPrimary, runCancel: context.runCancel, goToPage: context.goToPage };
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

/** A lista pendura a paginação enquanto ela vale, no mesmo contrato das ações de janela: nulo tira. */
export function useFloatingPagerRegistration(pager: FloatingPager | null) {
  const context = useContext(FloatingActionsContext);
  const register = context?.registerPager;

  useEffect(() => {
    register?.(pager);
  });

  useEffect(() => () => register?.(null), [register]);
}
