"use client";

import { ArrowCounterClockwiseIcon, ListBulletsIcon, MinusCircleIcon, PlusIcon, SquaresFourIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { Button } from "@/components/ui/button";
import type { DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Pagination } from "@/components/ui/pagination";
import { Text } from "@/components/ui/text";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { SCROLL_CONTAINER } from "@/lib/scroll";
import {
  CATALOG_PER_PAGE,
  CATEGORY_PARAM,
  DEFAULT_CATEGORY,
  GRID_PER_PAGE_DEFAULT,
  KIND_PARAM,
  PAGE_PARAM,
  PAGE_SIZE_PARAM,
  QUERY_PARAM,
  STATUS_PARAM,
  activeCatalogFilters,
  clearedFilters,
  defaultQuery,
  gridPageSize,
  kindFilterLabels,
  kindValues,
  remapPage,
  type CatalogListPage,
  type CatalogQuery,
} from "../list-options";
import type { CatalogItem } from "../summary";
import { saveCatalogGridSize, saveCatalogView, type CatalogView } from "../view-cookie";
import { CatalogCard } from "./catalog-card";
import { CatalogDrawer } from "./catalog-drawer";
import { CatalogFormDialog, type CatalogEditor } from "./catalog-form-dialog";
import { CatalogTable } from "./catalog-table";
import styles from "./catalog-board.module.css";

export type CatalogBoardProps = {
  page: CatalogListPage;
  query: CatalogQuery;
  /** O jeito de ver que o cookie guardou: grade de cartões ou tabela. */
  view: CatalogView;
  /** A ficha que a URL pede aberta na gaveta: um item para editar, `"new"` para criar, nada para só listar. */
  editing?: CatalogItem | "new";
};

/** Quanto o campo espera parar de digitar antes de refazer a busca no servidor. */
const TYPING_PAUSE = 320;

/** Quanto a grade espera a janela parar de mudar de largura antes de pedir outro tamanho de página. */
const RESIZE_PAUSE = 200;

const numberFormat = new Intl.NumberFormat("pt-BR");

/* Os dois jeitos de ver a mesma lista, no seletor da barra. */
const viewOptions = [
  { value: "grade", label: "Ver em grade", icon: <SquaresFourIcon /> },
  { value: "tabela", label: "Ver em tabela", icon: <ListBulletsIcon /> },
];

// A prancha do catálogo: a barra de busca e filtros em cima, a grade de cartões ou a tabela no meio e a
// paginação embaixo, na mesma estrutura da base de clientes. O filtro vive na URL e quem faz o trabalho é o
// servidor, então a página é compartilhável e volta igual pelo histórico; aqui ficam a espera do campo de
// busca, o filtro adiantado, o item aberto na gaveta, o jeito de ver e o ativo trocado na tela. Trocar
// qualquer filtro leva de volta para a primeira página.
export function CatalogBoard({ page, query, view: saved, editing }: CatalogBoardProps) {
  const router = useRouter();
  const [search, setSearch] = useState(query.search);
  // O filtro em vigor na tela, adiantado: a escolha marca na hora e a URL vai atrás. Quando a resposta
  // chega, o que veio da URL passa a valer, ajustado durante o render, como o React pede para prop nova.
  const [live, setLive] = useState(query);
  const [seen, setSeen] = useState(query);
  if (seen !== query) {
    setSeen(query);
    setLive(query);
  }
  // Uma gaveta só para a tela inteira, guardando quem está aberto. Fica montada e vazia depois de fechar,
  // para a saída animar.
  const [open, setOpen] = useState<CatalogItem | null>(null);
  // O jeito de ver vive em cookie, então o servidor já manda a página certa; o estado aqui é só para a
  // troca valer no clique, sem ida ao servidor. A tabela é coisa de desktop: no celular a grade vale
  // sempre, mesmo com a tabela guardada.
  const [view, setView] = useState<CatalogView>(saved);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const asTable = view === "tabela" && !mobile;
  // O último tamanho que a grade mediu, para a troca de visão já pedir o tamanho certo sem esperar a medida.
  const gridSize = useRef<number>(GRID_PER_PAGE_DEFAULT);
  const changeView = (next: CatalogView) => {
    setView(next);
    saveCatalogView(next);
    const pageSize = next === "tabela" ? CATALOG_PER_PAGE : gridSize.current;
    if (pageSize !== live.pageSize) go({ pageSize, page: remapPage(live.page, live.pageSize, pageSize) });
  };
  // Ativo trocado na tela, por item, enquanto não há regra no banco: mora aqui, e não no cartão, para o
  // cartão e a ficha dizerem a mesma coisa.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const isActive = (item: CatalogItem) => overrides[item.id] ?? item.active;
  const setActive = (item: CatalogItem) => (active: boolean) => setOverrides((current) => ({ ...current, [item.id]: active }));
  const typing = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(typing.current), []);

  // A ficha em edição na gaveta, no contrato da base de clientes: nasce do que a URL pediu (`/catalogo/novo`
  // ou `/catalogo/<id>`) e daí em diante troca só a URL, sem sair da tela, por `pushState`; o voltar do
  // navegador fecha pelo `popstate`.
  const [editor, setEditor] = useState<CatalogEditor>(editing ?? null);

  useEffect(() => {
    const onPopState = () => {
      const [, , segment] = window.location.pathname.split("/");
      if (!segment) setEditor(null);
      else if (segment === "novo") setEditor("new");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const editorPath = (next: CatalogEditor) => (next === null ? "/catalogo" : next === "new" ? "/catalogo/novo" : `/catalogo/${next.id}`);

  const openEditor = (next: CatalogEditor) => {
    setEditor(next);
    window.history.pushState(null, "", `${editorPath(next)}${window.location.search}`);
  };

  // Editar quem já está na tela abre no lugar: o item da lista já é a ficha inteira, então o formulário
  // entra preenchido na hora, sem ida ao servidor.
  const editItem = (item: CatalogItem) => {
    setOpen(null);
    openEditor(item);
  };

  const go = useCallback(
    (next: Partial<CatalogQuery>) => {
      const merged = { ...live, ...next };
      setLive(merged);
      const params = new URLSearchParams();
      if (merged.search) params.set(QUERY_PARAM, merged.search);
      if (merged.kind !== defaultQuery.kind) params.set(KIND_PARAM, merged.kind);
      if (merged.category !== defaultQuery.category) params.set(CATEGORY_PARAM, merged.category);
      if (merged.status !== defaultQuery.status) params.set(STATUS_PARAM, merged.status);
      if (merged.page > 1) params.set(PAGE_PARAM, String(merged.page));
      if (merged.pageSize !== CATALOG_PER_PAGE) params.set(PAGE_SIZE_PARAM, String(merged.pageSize));

      const search = params.toString();
      const base = editorPath(editor);
      startTransition(() => router.replace((search ? `${base}?${search}` : base) as Route, { scroll: false }));
    },
    [live, editor, router],
  );

  // Cada tecla refaz a página no servidor, então o campo espera a pessoa parar de digitar.
  const onSearch = (value: string) => {
    setSearch(value);
    window.clearTimeout(typing.current);
    typing.current = window.setTimeout(() => go({ search: value, page: 1 }), TYPING_PAUSE);
  };

  // Trocar de página leva de volta ao começo da lista: no desktop quem rola é a área da grade, e no celular
  // a coluna de conteúdo da concha, e não o documento, então o `scroll` do roteador não os alcança. Macio,
  // salvo com movimento reduzido.
  const scrollArea = useRef<HTMLDivElement>(null);
  const changePage = (next: number) => {
    go({ page: next });
    const column = scrollArea.current ?? document.querySelector<HTMLElement>(`[${SCROLL_CONTAINER}]`) ?? document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    column.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  // A grade mede quantas colunas formou e pede ao servidor a página que cabe em três linhas, sempre par
  // (pedido de 2026-09-08). As colunas saem da lista de trilhas já resolvida pelo navegador, então valem
  // para o `auto-fill`. A medida entra no cookie para a próxima visita já vir do tamanho certo, e só pede
  // outra página quando o tamanho muda de verdade, depois de a janela parar de mudar.
  const gridRef = useRef<HTMLUListElement>(null);
  const showing = page.items.length;
  const currentSize = live.pageSize;
  const currentPage = live.page;
  useEffect(() => {
    const grid = gridRef.current;
    if (asTable || !grid) return;
    let timer: number | undefined;
    const observer = new ResizeObserver(() => {
      const columns = getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length;
      const size = gridPageSize(columns);
      gridSize.current = size;
      saveCatalogGridSize(size);
      window.clearTimeout(timer);
      if (size === currentSize) return;
      timer = window.setTimeout(
        () =>
          go({
            pageSize: size,
            page: remapPage(currentPage, currentSize, size),
          }),
        RESIZE_PAUSE,
      );
    });
    observer.observe(grid);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [asTable, showing, currentSize, currentPage, go]);

  const createItem = () => openEditor("new");

  const pages = Math.max(1, Math.ceil(page.total / live.pageSize));
  const from = (live.page - 1) * live.pageSize + 1;
  const to = Math.min(live.page * live.pageSize, page.total);
  const active = activeCatalogFilters(live);

  /* O menu de filtros, no desenho do da base de clientes: tipo e categoria em escolha única, marcada pelo
     check; inativos em interruptor, porque quase tudo é ativo e o filtro útil é o de quem saiu de linha. As
     categorias vêm da base inteira, e não da página. Cada escolha vale na hora e não fecha o menu. */
  const filterSections: DropdownSection[] = [
    {
      id: "kind",
      label: "Tipo",
      items: kindValues.map((value) => ({
        id: `kind-${value}`,
        label: kindFilterLabels[value],
        selected: live.kind === value,
        keepOpen: true,
        onSelect: () => go({ kind: value, page: 1 }),
      })),
    },
    {
      id: "category",
      label: "Categoria",
      items: [
        {
          id: "category-all",
          label: "Todas as categorias",
          selected: live.category === DEFAULT_CATEGORY,
          keepOpen: true,
          onSelect: () => go({ category: DEFAULT_CATEGORY, page: 1 }),
        },
        ...page.categories.map((category) => ({
          id: `category-${category}`,
          label: category,
          selected: live.category === category,
          keepOpen: true,
          onSelect: () => go({ category, page: 1 }),
        })),
      ],
    },
    {
      id: "status",
      label: "Situação",
      items: [
        {
          kind: "toggle",
          id: "inactive",
          label: "Só inativos",
          icon: MinusCircleIcon,
          checked: live.status === "inativos",
          onChange: (on) => go({ status: on ? "inativos" : "todos", page: 1 }),
        },
      ],
    },
    ...(active.length > 0
      ? [
          {
            id: "reset",
            items: [
              {
                id: "reset",
                label: "Limpar filtros",
                icon: ArrowCounterClockwiseIcon,
                onSelect: () => go(clearedFilters),
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <div className={styles.board}>
      <PageToolbar
        search={{
          value: search,
          onChange: onSearch,
          placeholder: "Buscar no catálogo",
          label: "Buscar produto ou serviço",
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
          onChange: (next) => changeView(next === "tabela" ? "tabela" : "grade"),
          label: "Jeito de ver a lista",
        }}
        action={
          /* Texto no desktop e só o ícone no celular, por CSS e não por media query em JS, para a marcação
             não saltar na hidratação: os dois existem e cada largura mostra um. */
          <>
            <span className={styles.wide}>
              <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={createItem}>
                Novo item
              </Button>
            </span>
            <span className={styles.narrow}>
              <IconButton label="Novo item" size="sm" radius="md" onClick={createItem}>
                <PlusIcon />
              </IconButton>
            </span>
          </>
        }
      />

      {asTable ? (
        <CatalogTable
          items={page.items}
          isActive={isActive}
          onActiveChange={setActive}
          onOpen={setOpen}
          onEdit={editItem}
          range={{
            page: live.page,
            pageSize: live.pageSize,
            total: page.total,
          }}
          footer={
            pages > 1 ? (
              <Pagination page={live.page} pageSize={live.pageSize} total={page.total} onPageChange={changePage} label="Páginas do catálogo" />
            ) : undefined
          }
        />
      ) : page.items.length === 0 ? (
        <div className={styles.empty}>
          <Text variant="callout" weight="semibold">
            Nada no catálogo por aqui
          </Text>
          <Text variant="footnote" tone="secondary">
            {query.search
              ? "Nada bateu com o que você procurou. Tente outro nome, categoria ou descrição."
              : "Ajuste o tipo, a categoria ou a situação para ver mais."}
          </Text>
        </div>
      ) : (
        <div ref={scrollArea} className={styles.scrollArea}>
          <ul ref={gridRef} className={styles.grid}>
            {page.items.map((item) => (
              <CatalogCard key={item.id} item={item} active={isActive(item)} onActiveChange={setActive(item)} onOpen={() => setOpen(item)} onEdit={() => editItem(item)} />
            ))}
          </ul>
        </div>
      )}

      {/* O pé da grade, preso embaixo e à direita no desktop (pedido de 2026-09-08, porque subia e descia com
          a altura da grade): a contagem e, passando de uma página, a barra. Na tabela ele mora no pé da
          própria tabela. */}
      {!asTable && page.items.length > 0 && (
        <div className={styles.foot}>
          <Text as="span" variant="footnote" tone="secondary">
            Mostrando {numberFormat.format(from)} a {numberFormat.format(to)} de {numberFormat.format(page.total)}
          </Text>
          {pages > 1 && <Pagination page={live.page} pageSize={live.pageSize} total={page.total} onPageChange={changePage} label="Páginas do catálogo" />}
        </div>
      )}

      <CatalogDrawer
        item={open}
        active={open ? isActive(open) : true}
        onActiveChange={open ? setActive(open) : () => undefined}
        onClose={() => setOpen(null)}
        onEdit={() => open && editItem(open)}
      />
      <CatalogFormDialog
        editor={editor}
        categories={page.categories}
        onClose={() => openEditor(null)}
        onSaved={() => {
          openEditor(null);
          router.refresh();
        }}
      />
    </div>
  );
}
