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
  primary: { label: string; loading?: boolean; disabled?: boolean; onClick: () => void };
  /** Ações em glifo entre a principal e o sair, na ordem em que aparecem. Vazio ou ausente não desenha nada. */
  extras?: readonly FloatingExtraAction[];
  cancel: { label: string; onClick: () => void };
};

/**
 * Uma pergunta de sim ou não que a janela faz **dentro da própria barra**, no lugar de abrir mais uma camada
 * por cima dela (2026-09-10, a pedido: no celular a confirmação de sair do editor de orçamento mora aqui).
 * A barra já é onde as ações da janela vivem no celular, então perguntar ali é perguntar onde a mão está, e
 * a bandeja que subiria para isso empilhava janela sobre janela para uma escolha de três palavras.
 *
 * São três saídas, como a janela de confirmação tem: confirmar, recusar e voltar. O texto é curto de
 * propósito, porque a barra é uma linha: quem precisa explicar mais que isso pede uma janela de verdade.
 */
export type FloatingConfirm = {
  /** A pergunta, em três ou quatro palavras: "Salvar as alterações?". */
  question: string;
  /** O que confirma, em destaque: "Salvar". */
  confirm: { label: string; loading?: boolean; onClick: () => void };
  /** O que recusa e segue com a saída: "Descartar". */
  deny: { label: string; onClick: () => void };
  /** Voltar para a janela sem decidir nada; é o X da barra. */
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

type Shape = { primaryLabel: string; loading: boolean; disabled: boolean; cancelLabel: string; extras: readonly ExtraShape[] } | null;

/* O mesmo para a confirmação: a pergunta e os nomes mudam a marcação; os disparos ficam na referência. */
type ConfirmShape = { question: string; confirmLabel: string; loading: boolean; denyLabel: string; cancelLabel: string } | null;

/* O mesmo para a paginação: página, total e nome mudam a marcação; o disparo fica na referência. */
type PagerShape = { page: number; pageCount: number; label: string } | null;

type ContextValue = {
  shape: Shape;
  confirm: ConfirmShape;
  pager: PagerShape;
  runPrimary: () => void;
  runExtra: (index: number) => void;
  runCancel: () => void;
  runConfirm: () => void;
  runDeny: () => void;
  runConfirmCancel: () => void;
  goToPage: (page: number) => void;
  register: (actions: FloatingActions | null) => void;
  registerConfirm: (confirm: FloatingConfirm | null) => void;
  registerPager: (pager: FloatingPager | null) => void;
};

const FloatingActionsContext = createContext<ContextValue | null>(null);

function shapeOf(actions: FloatingActions | null): Shape {
  if (!actions) return null;
  return {
    primaryLabel: actions.primary.label,
    loading: actions.primary.loading ?? false,
    disabled: actions.primary.disabled ?? false,
    cancelLabel: actions.cancel.label,
    extras: (actions.extras ?? []).map((extra) => ({ label: extra.label, icon: extra.icon, loading: extra.loading ?? false, disabled: extra.disabled ?? false })),
  };
}

/* O glifo é comparado por identidade: quem registra o monta no render, e um elemento novo a cada tecla
   digitada faria a barra redesenhar sem necessidade, então o nome é o que diz se a ação é a mesma. */
const sameExtras = (a: readonly ExtraShape[], b: readonly ExtraShape[]) =>
  a.length === b.length && a.every((extra, index) => extra.label === b[index]?.label && extra.loading === b[index]?.loading && extra.disabled === b[index]?.disabled);

function sameShape(a: Shape, b: Shape) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.primaryLabel === b.primaryLabel && a.loading === b.loading && a.disabled === b.disabled && a.cancelLabel === b.cancelLabel && sameExtras(a.extras, b.extras);
}

function confirmShapeOf(confirm: FloatingConfirm | null): ConfirmShape {
  if (!confirm) return null;
  return {
    question: confirm.question,
    confirmLabel: confirm.confirm.label,
    loading: confirm.confirm.loading ?? false,
    denyLabel: confirm.deny.label,
    cancelLabel: confirm.cancel.label,
  };
}

function sameConfirmShape(a: ConfirmShape, b: ConfirmShape) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.question === b.question && a.confirmLabel === b.confirmLabel && a.loading === b.loading && a.denyLabel === b.denyLabel && a.cancelLabel === b.cancelLabel;
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
  const confirmHandlers = useRef<FloatingConfirm | null>(null);
  const pagerHandlers = useRef<FloatingPager | null>(null);
  const [shape, setShape] = useState<Shape>(null);
  const [confirm, setConfirm] = useState<ConfirmShape>(null);
  const [pager, setPager] = useState<PagerShape>(null);

  const register = useCallback((actions: FloatingActions | null) => {
    handlers.current = actions;
    const next = shapeOf(actions);
    setShape((current) => (sameShape(current, next) ? current : next));
  }, []);

  const registerConfirm = useCallback((next: FloatingConfirm | null) => {
    confirmHandlers.current = next;
    const shaped = confirmShapeOf(next);
    setConfirm((current) => (sameConfirmShape(current, shaped) ? current : shaped));
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
    if (!shape && !confirm) return;
    document.documentElement.dataset.floatingActions = "";
    return () => {
      delete document.documentElement.dataset.floatingActions;
    };
  }, [shape, confirm]);

  const runPrimary = useCallback(() => handlers.current?.primary.onClick(), []);
  const runConfirm = useCallback(() => confirmHandlers.current?.confirm.onClick(), []);
  const runDeny = useCallback(() => confirmHandlers.current?.deny.onClick(), []);
  const runConfirmCancel = useCallback(() => confirmHandlers.current?.cancel.onClick(), []);
  const runExtra = useCallback((index: number) => handlers.current?.extras?.[index]?.onClick(), []);
  const runCancel = useCallback(() => handlers.current?.cancel.onClick(), []);
  const goToPage = useCallback((page: number) => pagerHandlers.current?.onPageChange(page), []);

  const value = useMemo(
    () => ({ shape, confirm, pager, runPrimary, runExtra, runCancel, runConfirm, runDeny, runConfirmCancel, goToPage, register, registerConfirm, registerPager }),
    [shape, confirm, pager, runPrimary, runExtra, runCancel, runConfirm, runDeny, runConfirmCancel, goToPage, register, registerConfirm, registerPager],
  );

  return <FloatingActionsContext.Provider value={value}>{children}</FloatingActionsContext.Provider>;
}

const silent = () => undefined;

/** O que a barra lê: a forma das ações, da pergunta e da paginação, e os disparos. Vazio fora da concha. */
export function useFloatingActions() {
  const context = useContext(FloatingActionsContext);
  if (!context) {
    return { shape: null, confirm: null, pager: null, runPrimary: silent, runExtra: silent, runCancel: silent, runConfirm: silent, runDeny: silent, runConfirmCancel: silent, goToPage: silent };
  }
  return {
    shape: context.shape,
    confirm: context.confirm,
    pager: context.pager,
    runPrimary: context.runPrimary,
    runExtra: context.runExtra,
    runCancel: context.runCancel,
    runConfirm: context.runConfirm,
    runDeny: context.runDeny,
    runConfirmCancel: context.runConfirmCancel,
    goToPage: context.goToPage,
  };
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

/**
 * A janela pendura a pergunta enquanto ela está à vista, no mesmo contrato das ações: nulo tira. Com uma
 * pergunta pendurada a barra vira ela inteira, e as ações da janela ficam guardadas até a resposta, porque
 * decidir é o que está em jogo e salvar por trás da pergunta não faria sentido.
 */
export function useFloatingConfirmRegistration(confirm: FloatingConfirm | null) {
  const context = useContext(FloatingActionsContext);
  const register = context?.registerConfirm;

  useEffect(() => {
    register?.(confirm);
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
