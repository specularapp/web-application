"use client";

import { ArrowCounterClockwiseIcon, PlusIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useFloatingPagerRegistration } from "@/components/layout/floating-actions";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { Button } from "@/components/ui/button";
import type { DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Pagination } from "@/components/ui/pagination";
import type { CatalogItem } from "@/features/catalog/summary";
import type { ClientListItem } from "@/features/clients/list-options";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { remapPage } from "@/lib/utils/paging";
import { quoteStatuses } from "../labels";
import {
  MOBILE_PER_PAGE,
  PAGE_PARAM,
  PAGE_SIZE_PARAM,
  PERIOD_PARAM,
  QUERY_PARAM,
  QUOTES_PER_PAGE,
  STATUS_PARAM,
  activeQuotesFilters,
  clearedFilters,
  defaultQuery,
  periodOptions,
  statusFilterLabels,
  statusFilterValues,
  type QuotesListPage,
  type QuotesQuery,
} from "../list-options";
import type { Quote, QuoteIssuer, QuotePerson } from "../summary";
import { QuoteEditorDialog, type QuoteEditor, type QuotePrefill } from "./quote-editor-dialog";
import { QuotesTable } from "./quotes-table";
import styles from "./quotes-board.module.css";

export type QuotesBoardProps = {
  page: QuotesListPage;
  query: QuotesQuery;
  /** O orçamento que a URL pede aberto no editor: um para editar, `"new"` para criar, nada para só listar. */
  editing?: Quote | "new";
  prefill?: QuotePrefill;
  clients: ClientListItem[];
  catalog: CatalogItem[];
  issuer: QuoteIssuer;
  owner: QuotePerson;
  nextNumber: string;
};

/** Quanto o campo espera parar de digitar antes de refazer a busca no servidor. */
const TYPING_PAUSE = 320;

/** Quanto a prancha espera a janela parar de mudar de largura antes de pedir outro tamanho de página. */
const RESIZE_PAUSE = 200;

// A prancha de orçamentos: a barra de busca e filtros em cima e a tabela tomando o resto, com a paginação no
// pé dela, na receita do catálogo e da base de clientes, só que sem grade: orçar e acompanhar são a mesma
// tela (decisão de 2026-09-09), e a lista é sempre tabela. O filtro vive na URL e quem faz o trabalho é o
// servidor; aqui ficam a espera do campo de busca, o filtro adiantado e o orçamento aberto no editor, que tem
// endereço (`/orcamentos/novo`, `/orcamentos/<id>`) como a ficha do cliente. Trocar qualquer filtro leva de
// volta para a primeira página.
export function QuotesBoard({ page, query, editing, prefill, clients, catalog, issuer, owner, nextNumber }: QuotesBoardProps) {
  const router = useRouter();
  const [search, setSearch] = useState(query.search);
  const [live, setLive] = useState(query);
  const [seen, setSeen] = useState(query);
  if (seen !== query) {
    setSeen(query);
    setLive(query);
  }
  const mobile = useMediaQuery(MOBILE_QUERY);
  const typing = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(typing.current), []);

  // O editor com endereço, no contrato da base de clientes: nasce do que a URL pediu e daí em diante troca
  // só a URL por `pushState`; o voltar do navegador fecha pelo `popstate`.
  const [editor, setEditor] = useState<QuoteEditor>(editing ?? null);

  useEffect(() => {
    const onPopState = () => {
      const [, , segment] = window.location.pathname.split("/");
      if (!segment) setEditor(null);
      else if (segment === "novo") setEditor("new");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const editorPath = (next: QuoteEditor) => (next === null ? "/orcamentos" : next === "new" ? "/orcamentos/novo" : `/orcamentos/${next.id}`);

  const openEditor = (next: QuoteEditor) => {
    setEditor(next);
    // Ao fechar, os parâmetros de pré-preenchimento saem da URL junto com o editor.
    const params = new URLSearchParams(window.location.search);
    if (next === null) {
      params.delete("item");
      params.delete("cliente");
    }
    const search = params.toString();
    window.history.pushState(null, "", `${editorPath(next)}${search ? `?${search}` : ""}`);
  };

  const go = useCallback(
    (next: Partial<QuotesQuery>) => {
      const merged = { ...live, ...next };
      setLive(merged);
      const params = new URLSearchParams();
      if (merged.search) params.set(QUERY_PARAM, merged.search);
      if (merged.status !== defaultQuery.status) params.set(STATUS_PARAM, merged.status);
      if (merged.period !== defaultQuery.period) params.set(PERIOD_PARAM, merged.period);
      if (merged.page > 1) params.set(PAGE_PARAM, String(merged.page));
      if (merged.pageSize !== QUOTES_PER_PAGE) params.set(PAGE_SIZE_PARAM, String(merged.pageSize));

      const search = params.toString();
      const base = editorPath(editor);
      startTransition(() => router.replace((search ? `${base}?${search}` : base) as Route, { scroll: false }));
    },
    [live, editor, router],
  );

  // No celular a página é doze, como nas outras listas; a tabela rola na horizontal e a paginação vai para a
  // barra flutuante. O servidor não sabe a largura, então a primeira página chega com trinta e a tela pede
  // doze em seguida, medindo a prancha como a grade do catálogo mede as colunas: quando a largura muda de
  // lado da dobra, depois de a janela parar de mudar.
  const boardRef = useRef<HTMLDivElement>(null);
  const currentSize = live.pageSize;
  const currentPage = live.page;
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    let timer: number | undefined;
    const observer = new ResizeObserver(() => {
      const size = window.matchMedia(MOBILE_QUERY).matches ? MOBILE_PER_PAGE : QUOTES_PER_PAGE;
      window.clearTimeout(timer);
      if (size === currentSize) return;
      timer = window.setTimeout(() => go({ pageSize: size, page: remapPage(currentPage, currentSize, size) }), RESIZE_PAUSE);
    });
    observer.observe(board);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [currentSize, currentPage, go]);

  const onSearch = (value: string) => {
    setSearch(value);
    window.clearTimeout(typing.current);
    typing.current = window.setTimeout(() => go({ search: value, page: 1 }), TYPING_PAUSE);
  };

  const changePage = (next: number) => go({ page: next });

  const pages = Math.max(1, Math.ceil(page.total / live.pageSize));
  const active = activeQuotesFilters(live);

  useFloatingPagerRegistration(mobile && pages > 1 ? { page: live.page, pageCount: pages, onPageChange: changePage, label: "Páginas de orçamentos" } : null);

  /* O menu de filtros: a situação em escolha única, com quantos há em cada uma na base inteira, e o período
     de emissão. Cada escolha vale na hora e não fecha o menu. */
  const filterSections: DropdownSection[] = [
    {
      id: "status",
      label: "Situação",
      items: statusFilterValues.map((value) => ({
        id: `status-${value}`,
        label: statusFilterLabels[value],
        icon: value === "todos" ? undefined : quoteStatuses[value].icon,
        count: value === "todos" ? undefined : page.counts[value],
        selected: live.status === value,
        keepOpen: true,
        onSelect: () => go({ status: value, page: 1 }),
      })),
    },
    {
      id: "period",
      label: "Emissão",
      items: periodOptions.map((option) => ({
        id: `period-${option.value}`,
        label: option.label,
        selected: live.period === option.value,
        keepOpen: true,
        onSelect: () => go({ period: option.value, page: 1 }),
      })),
    },
    ...(active.length > 0
      ? [{ id: "reset", items: [{ id: "reset", label: "Limpar filtros", icon: ArrowCounterClockwiseIcon, onSelect: () => go(clearedFilters) }] }]
      : []),
  ];

  return (
    <div ref={boardRef} className={styles.board}>
      <PageToolbar
        search={{
          value: search,
          onChange: onSearch,
          placeholder: "Buscar orçamentos",
          label: "Buscar orçamento por número, título ou cliente",
        }}
        filters={filterSections}
        activeFilters={active.map((filter) => ({
          id: filter.id,
          label: filter.label,
          icon: filter.icon,
          onClear: () => go({ ...filter.clear, page: 1 }),
        }))}
        action={
          <>
            <span className={styles.wide}>
              <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => openEditor("new")}>
                Novo orçamento
              </Button>
            </span>
            <span className={styles.narrow}>
              <IconButton label="Novo orçamento" size="sm" radius="md" onClick={() => openEditor("new")}>
                <PlusIcon />
              </IconButton>
            </span>
          </>
        }
      />

      <QuotesTable
        quotes={page.items}
        onOpen={openEditor}
        range={{ page: live.page, pageSize: live.pageSize, total: page.total }}
        footer={pages > 1 && !mobile ? <Pagination page={live.page} pageSize={live.pageSize} total={page.total} onPageChange={changePage} label="Páginas de orçamentos" /> : undefined}
      />

      <QuoteEditorDialog
        editor={editor}
        clients={clients}
        catalog={catalog}
        issuer={issuer}
        owner={owner}
        nextNumber={nextNumber}
        prefill={prefill}
        onClose={() => openEditor(null)}
        onSaved={() => {
          openEditor(null);
          router.refresh();
        }}
      />
    </div>
  );
}
