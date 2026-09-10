"use client";

import { ArrowCounterClockwiseIcon, ListBulletsIcon, PlusIcon, SquaresFourIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useFloatingPagerRegistration } from "@/components/layout/floating-actions";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { Button } from "@/components/ui/button";
import type { DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Pagination } from "@/components/ui/pagination";
import { Text } from "@/components/ui/text";
import type { CatalogItem } from "@/features/catalog/summary";
import type { ClientListItem } from "@/features/clients/list-options";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { SCROLL_CONTAINER } from "@/lib/scroll";
import { remapPage } from "@/lib/utils/paging";
import { quoteStatuses } from "../labels";
import {
  GRID_PER_PAGE_DEFAULT,
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
  gridPageSize,
  periodOptions,
  statusFilterLabels,
  statusFilterValues,
  type QuotesListPage,
  type QuotesQuery,
} from "../list-options";
import type { Quote, QuoteIssuer, QuotePerson } from "../summary";
import { saveQuotesGridSize, saveQuotesView, type QuotesView } from "../view-cookie";
import { QuoteCard } from "./quote-card";
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
  /** O jeito de ver que o cookie guardou: tabela ou grade de cartões. */
  view: QuotesView;
};

/** Quanto o campo espera parar de digitar antes de refazer a busca no servidor. */
const TYPING_PAUSE = 320;

/** Quanto a prancha espera a janela parar de mudar de largura antes de pedir outro tamanho de página. */
const RESIZE_PAUSE = 200;

const numberFormat = new Intl.NumberFormat("pt-BR");

/* Os dois jeitos de ver a mesma lista, no seletor da barra: a tabela primeiro, porque é o padrão daqui. */
const viewOptions = [
  { value: "tabela", label: "Ver em tabela", icon: <ListBulletsIcon /> },
  { value: "grade", label: "Ver em grade", icon: <SquaresFourIcon /> },
];

// A prancha de orçamentos: a barra de busca e filtros em cima, a tabela ou a grade de cartões tomando o resto
// e a paginação no pé, na receita do catálogo e da base de clientes. A tabela é o padrão (decisão de
// 2026-09-09: orçar e acompanhar são a mesma tela) e a grade entrou em 2026-09-10, a pedido, com o mesmo
// cartão dos outros; no celular vale sempre a grade, porque tabela é coisa de desktop. O filtro vive na URL e
// quem faz o trabalho é o servidor; aqui ficam a espera do campo de busca, o filtro adiantado, o jeito de ver,
// o tamanho da página da grade e o orçamento aberto no editor, que tem endereço (`/orcamentos/novo`,
// `/orcamentos/<id>`) como a ficha do cliente. Trocar qualquer filtro leva de volta para a primeira página.
export function QuotesBoard({ page, query, editing, prefill, clients, catalog, issuer, owner, nextNumber, view: saved }: QuotesBoardProps) {
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
  // O jeito de ver vive em cookie, então o servidor já manda a página certa; o estado aqui é só para a troca
  // valer no clique. A tabela é coisa de desktop: no celular a grade vale sempre.
  const [view, setView] = useState<QuotesView>(saved);
  const asTable = view === "tabela" && !mobile;
  // O último tamanho que a grade mediu, para a troca de visão já pedir o tamanho certo sem esperar a medida.
  const gridSize = useRef<number>(GRID_PER_PAGE_DEFAULT);

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

  const changeView = (next: QuotesView) => {
    setView(next);
    saveQuotesView(next);
    const pageSize = next === "tabela" ? QUOTES_PER_PAGE : gridSize.current;
    if (pageSize !== live.pageSize) go({ pageSize, page: remapPage(live.page, live.pageSize, pageSize) });
  };

  // A grade mede quantas colunas formou e pede ao servidor a página que cabe em três linhas, sempre par, na
  // mesma receita do catálogo e da base de clientes; no celular a página é sempre doze. A medida entra no
  // cookie para a próxima visita já vir do tamanho certo, e só pede outra página quando o tamanho muda de
  // verdade, depois de a janela parar de mudar. Na tabela, que só existe no desktop, valem os trinta.
  const gridRef = useRef<HTMLUListElement>(null);
  const showing = page.items.length;
  const currentSize = live.pageSize;
  const currentPage = live.page;
  useEffect(() => {
    const grid = gridRef.current;
    let timer: number | undefined;
    const request = (size: number) => {
      window.clearTimeout(timer);
      if (size === currentSize) return;
      timer = window.setTimeout(() => go({ pageSize: size, page: remapPage(currentPage, currentSize, size) }), RESIZE_PAUSE);
    };
    if (asTable || !grid) {
      if (asTable) request(QUOTES_PER_PAGE);
      return () => window.clearTimeout(timer);
    }
    const observer = new ResizeObserver(() => {
      const columns = getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length;
      const size = mobile ? MOBILE_PER_PAGE : gridPageSize(columns);
      gridSize.current = size;
      // O cookie guarda só a medida do desktop: o doze fixo do celular gravado ali faria o desktop abrir
      // curto antes de medir.
      if (!mobile) saveQuotesGridSize(size);
      request(size);
    });
    observer.observe(grid);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [asTable, mobile, showing, currentSize, currentPage, go]);

  const onSearch = (value: string) => {
    setSearch(value);
    window.clearTimeout(typing.current);
    typing.current = window.setTimeout(() => go({ search: value, page: 1 }), TYPING_PAUSE);
  };

  // Trocar de página leva de volta ao começo da lista: no desktop quem rola é a área da grade, e no celular a
  // coluna de conteúdo da concha, então o alvo é o primeiro dos dois que de fato tenha o que rolar.
  const scrollArea = useRef<HTMLDivElement>(null);
  const changePage = (next: number) => {
    go({ page: next });
    const area = scrollArea.current;
    const column = (area && area.scrollHeight > area.clientHeight ? area : null) ?? document.querySelector<HTMLElement>(`[${SCROLL_CONTAINER}]`) ?? document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    column.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  const pages = Math.max(1, Math.ceil(page.total / live.pageSize));
  const from = (live.page - 1) * live.pageSize + 1;
  const to = Math.min(live.page * live.pageSize, page.total);
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

  const pagination =
    pages > 1 && !mobile ? <Pagination page={live.page} pageSize={live.pageSize} total={page.total} onPageChange={changePage} label="Páginas de orçamentos" /> : undefined;

  return (
    <div className={styles.board}>
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
        view={{
          value: view,
          options: viewOptions,
          onChange: (next) => changeView(next === "grade" ? "grade" : "tabela"),
          label: "Jeito de ver a lista",
        }}
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

      {asTable ? (
        <QuotesTable quotes={page.items} onOpen={openEditor} range={{ page: live.page, pageSize: live.pageSize, total: page.total }} footer={pagination} />
      ) : page.items.length === 0 ? (
        <div className={styles.empty}>
          <Text variant="callout" weight="semibold">
            Nenhum orçamento por aqui
          </Text>
          <Text variant="footnote" tone="secondary">
            {query.search ? "Nada bateu com o que você procurou. Tente outro número, título ou cliente." : "Ajuste a situação ou o período para ver mais."}
          </Text>
        </div>
      ) : (
        <div ref={scrollArea} className={styles.scrollArea}>
          <ul ref={gridRef} className={styles.grid}>
            {page.items.map((quote) => (
              <QuoteCard key={quote.id} quote={quote} onOpen={() => openEditor(quote)} />
            ))}
          </ul>
        </div>
      )}

      {/* O pé da grade, preso embaixo e à direita no desktop, como no catálogo: a contagem e, passando de uma
          página, a barra. Na tabela ele mora no pé da própria tabela. */}
      {!asTable && page.items.length > 0 && (
        <div className={styles.foot}>
          <Text as="span" variant="footnote" tone="secondary">
            Mostrando {numberFormat.format(from)} a {numberFormat.format(to)} de {numberFormat.format(page.total)}
          </Text>
          {pagination}
        </div>
      )}

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
