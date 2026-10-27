"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

export const LIST_PAGE_SIZES = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 50;

/*
 * O tamanho da página vale para todas as listas da aba, como na pousada: quem prefere 100 linhas prefere em
 * todas. Lá ele mora no `localStorage`; aqui, que proíbe Web Storage, ele fica na memória da aba (2026-10-26),
 * e a própria aba se avisa pelo conjunto abaixo.
 */
const listeners = new Set<() => void>();
let session: number | null = null;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const readSize = () => session ?? DEFAULT_PAGE_SIZE;

export type ListPagination<T> = {
  /** As linhas da página de agora: é só isto que a tabela desenha. */
  rows: T[];
  page: number;
  pageCount: number;
  pageSize: number;
  /** Os tamanhos que o seletor oferece: os da casa ou os próprios da lista. */
  sizes: readonly number[];
  total: number;
  /** A primeira e a última linha da página, contadas de 1 (0 e 0 quando a lista está vazia). */
  from: number;
  to: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
};

/**
 * Corta uma lista já filtrada e ordenada em páginas, trazido do sistema da pousada (2026-10-26). Desenhar 900
 * linhas de uma vez pesa no navegador; desenhar 50 não. `resetKey` é o retrato dos filtros e da ordem: quando ele
 * muda a lista volta à primeira página, mas quando só os dados mudam a pessoa fica na página em que estava.
 */
export function useListPagination<T>(items: readonly T[], resetKey: string, options: { sizes?: readonly number[] } = {}): ListPagination<T> {
  const shared = useSyncExternalStore(subscribe, readSize, () => DEFAULT_PAGE_SIZE);
  /* Uma lista com tamanhos próprios guarda a escolha só nela, sem mexer no tamanho das outras. */
  const own = options.sizes;
  const [ownSize, setOwnSize] = useState(own?.[0] ?? DEFAULT_PAGE_SIZE);
  const size = own ? ownSize : shared;
  const [state, setState] = useState({ page: 1, key: resetKey });

  /* Trocar o filtro devolve à primeira página: ajusta durante o desenho, sem a piscada de um efeito. */
  let requested = state.page;
  if (state.key !== resetKey) {
    requested = 1;
    setState({ page: 1, key: resetKey });
  }

  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(requested, pageCount);
  const start = (page - 1) * size;

  const setPage = useCallback((next: number) => {
    setState((current) => ({ ...current, page: Math.max(1, next) }));
    // A lista rola dentro da própria tela: sem isto, a página nova abriria no meio, na altura em que a anterior estava.
    requestAnimationFrame(() => document.querySelector("[data-list-scroll]")?.scrollTo({ top: 0 }));
  }, []);

  const setPageSize = useCallback(
    (next: number) => {
      if (own) {
        setOwnSize(next);
        setState((current) => ({ ...current, page: 1 }));
        return;
      }
      session = next;
      listeners.forEach((listener) => listener());
      setState((current) => ({ ...current, page: 1 }));
    },
    [own],
  );

  return {
    rows: items.slice(start, start + size),
    page,
    pageCount,
    pageSize: size,
    sizes: own ?? LIST_PAGE_SIZES,
    total: items.length,
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + size, items.length),
    setPage,
    setPageSize,
  };
}
