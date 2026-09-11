"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * Uma ação secundária da barra, só em glifo: é o que o editor de orçamento pendura ao lado de salvar depois
 * que enviar e copiar o link saíram do cabeçalho no celular (2026-09-10, a pedido). O nome vai na voz e na
 * dica, porque o botão não tem texto.
 */
export type FloatingExtraAction = { label: string; icon: ReactNode; loading?: boolean; disabled?: boolean; onClick: () => void };

/** As ações que uma janela pendura na barra flutuante do celular: a principal, com o nome, e a de sair. */
export type FloatingActions = {
  /**
   * A ação principal. O glifo é o check de salvar por padrão, que é o que a maioria das janelas faz; quem
   * não salva passa o próprio (2026-09-11): a ficha da tarefa edita no lugar e nunca salva, então um check
   * ao lado de "Enviar" prometia uma gravação que não existe.
   */
  primary: {
    label: string;
    icon?: ReactNode;
    /**
     * A principal em glifo, no fim da barra (2026-09-11, a pedido, para o enviar da conversa): o nome vai só
     * para a voz e a dica, e ela troca de lugar com as secundárias, ficando encostada no sair. É o desenho
     * de um compositor, em que enviar é o último da fila e não precisa de rótulo.
     */
    iconOnly?: boolean;
    loading?: boolean;
    disabled?: boolean;
    onClick: () => void;
  };
  /** Ações em glifo entre a principal e o sair, na ordem em que aparecem. Vazio ou ausente não desenha nada. */
  extras?: readonly FloatingExtraAction[];
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
type ExtraShape = { label: string; icon: ReactNode; loading: boolean; disabled: boolean };

type Shape = {
  primaryLabel: string;
  primaryIcon?: ReactNode;
  primaryIconOnly: boolean;
  loading: boolean;
  disabled: boolean;
  cancelLabel: string;
  extras: readonly ExtraShape[];
} | null;

/* O mesmo para a paginação: página, total e nome mudam a marcação; o disparo fica na referência. */
type PagerShape = { page: number; pageCount: number; label: string } | null;

type ContextValue = {
  shape: Shape;
  pager: PagerShape;
  runPrimary: () => void;
  runExtra: (index: number) => void;
  runCancel: () => void;
  goToPage: (page: number) => void;
  register: (actions: FloatingActions | null) => void;
  registerPager: (pager: FloatingPager | null) => void;
};

const FloatingActionsContext = createContext<ContextValue | null>(null);

function shapeOf(actions: FloatingActions | null): Shape {
  if (!actions) return null;
  return {
    primaryLabel: actions.primary.label,
    primaryIcon: actions.primary.icon,
    primaryIconOnly: actions.primary.iconOnly ?? false,
    loading: actions.primary.loading ?? false,
    disabled: actions.primary.disabled ?? false,
    cancelLabel: actions.cancel.label,
    extras: (actions.extras ?? []).map((extra) => ({ label: extra.label, icon: extra.icon, loading: extra.loading ?? false, disabled: extra.disabled ?? false })),
  };
}

/* O glifo não entra na comparação, nem nas secundárias nem na principal: quem registra o monta no render, e
   um elemento novo a cada tecla digitada faria a barra redesenhar sem necessidade, então o nome é o que diz
   se a ação é a mesma. Ação que troca de glifo troca de nome junto, que é o caso de toda barra da casa. */
const sameExtras = (a: readonly ExtraShape[], b: readonly ExtraShape[]) =>
  a.length === b.length && a.every((extra, index) => extra.label === b[index]?.label && extra.loading === b[index]?.loading && extra.disabled === b[index]?.disabled);

function sameShape(a: Shape, b: Shape) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.primaryLabel === b.primaryLabel &&
    a.primaryIconOnly === b.primaryIconOnly &&
    a.loading === b.loading &&
    a.disabled === b.disabled &&
    a.cancelLabel === b.cancelLabel &&
    sameExtras(a.extras, b.extras)
  );
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
  const runExtra = useCallback((index: number) => handlers.current?.extras?.[index]?.onClick(), []);
  const runCancel = useCallback(() => handlers.current?.cancel.onClick(), []);
  const goToPage = useCallback((page: number) => pagerHandlers.current?.onPageChange(page), []);

  const value = useMemo(
    () => ({ shape, pager, runPrimary, runExtra, runCancel, goToPage, register, registerPager }),
    [shape, pager, runPrimary, runExtra, runCancel, goToPage, register, registerPager],
  );

  return <FloatingActionsContext.Provider value={value}>{children}</FloatingActionsContext.Provider>;
}

const silent = () => undefined;

/** O que a barra lê: a forma das ações e da paginação, e os disparos. Vazio fora da concha. */
export function useFloatingActions() {
  const context = useContext(FloatingActionsContext);
  if (!context) return { shape: null, pager: null, runPrimary: silent, runExtra: silent, runCancel: silent, goToPage: silent };
  return { shape: context.shape, pager: context.pager, runPrimary: context.runPrimary, runExtra: context.runExtra, runCancel: context.runCancel, goToPage: context.goToPage };
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
