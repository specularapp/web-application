"use client";

import { ArrowCounterClockwiseIcon, KanbanIcon, ListBulletsIcon, PlusIcon, ReceiptIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFloatingPagerRegistration } from "@/components/layout/floating-actions";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import type { DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Pagination } from "@/components/ui/pagination";
import { Text } from "@/components/ui/text";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { SCROLL_CONTAINER } from "@/lib/scroll";
import { remapPage } from "@/lib/utils/paging";
import { quoteStatuses } from "../labels";
import {
  FUNNEL_PER_PAGE,
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
import type { Quote } from "../summary";
import { saveQuotesView, type QuotesView } from "../view-cookie";
import { QuoteEditor, type QuoteEditorProps, type QuotePrefill } from "./quote-editor";
import { QuotesFunnel } from "./quotes-funnel";
import { QuotesTable } from "./quotes-table";
import styles from "./quotes-board.module.css";

export type QuotesBoardProps = {
  page: QuotesListPage;
  query: QuotesQuery;
  /** O jeito de ver que o cookie guardou: tabela ou grade de cartões. */
  view: QuotesView;
  /** O que o editor precisa para gerar um orçamento na janela, sem sair da lista. */
  editor: QuoteEditorData;
  /** A janela de gerar já aberta, quando a URL é `/orcamentos/novo`. */
  creating?: boolean;
  /** A janela de editar já aberta neste orçamento, quando a URL é `/orcamentos/<id>`. */
  editing?: Quote;
  /** O que chega preenchido de outra tela (`?item=` do catálogo, `?cliente=` da base de clientes). */
  prefill?: QuotePrefill;
};

export type QuoteEditorData = {
  clients: QuoteEditorProps["clients"];
  catalog: QuoteEditorProps["catalog"];
  issuer: QuoteEditorProps["issuer"];
  owner: QuoteEditorProps["owner"];
  nextNumber: string;
};

const LIST_PATH = "/orcamentos";
const NEW_PATH = "/orcamentos/novo";

/** Quanto o campo espera parar de digitar antes de refazer a busca no servidor. */
const TYPING_PAUSE = 320;

/** Quanto a prancha espera a janela parar de mudar de largura antes de pedir outro tamanho de página. */
const RESIZE_PAUSE = 200;

const numberFormat = new Intl.NumberFormat("pt-BR");

/* Os dois jeitos de ver a mesma lista, no seletor da barra: a tabela primeiro, porque é o padrão daqui. */
const viewOptions = [
  { value: "tabela", label: "Ver em tabela", icon: <ListBulletsIcon /> },
  { value: "grade", label: "Ver em funil", icon: <KanbanIcon /> },
];

// A prancha de orçamentos: a barra de busca e filtros em cima, a tabela ou a grade de cartões tomando o resto
// e a paginação no pé, na receita do catálogo e da base de clientes. A tabela é o padrão (decisão de
// 2026-09-09: orçar e acompanhar são a mesma tela) e a grade entrou em 2026-09-10, a pedido, com o mesmo
// cartão dos outros; no celular vale sempre a grade, porque tabela é coisa de desktop. O filtro vive na URL e
// quem faz o trabalho é o servidor; aqui ficam a espera do campo de busca, o filtro adiantado, o jeito de ver,
// o tamanho da página da grade e o orçamento aberto no editor, que tem endereço (`/orcamentos/novo`,
// `/orcamentos/<id>`) como a ficha do cliente. Trocar qualquer filtro leva de volta para a primeira página.
export function QuotesBoard({ page, query, view: saved, editor, creating = false, editing, prefill }: QuotesBoardProps) {
  const router = useRouter();
  /* Gerar e editar abrem o editor numa janela longa sobre a lista (2026-10-26, a pedido: primeiro o gerar, "ao
     invés de abrir página, um modal longo no mesmo padrão da edição", e depois o editar, "igual a parte de criar
     novo"), na receita da ficha do cliente: a URL vira `/orcamentos/novo` ou `/orcamentos/<id>` por `pushState`,
     que o roteador acompanha sem refazer nada no servidor, e o voltar do navegador fecha pelo `popstate`. Aberta
     direto, a URL cai nas páginas de novo e do orçamento, que montam a mesma lista com a janela já aberta. */
  const routeTarget: Quote | "new" | null = editing ?? (creating ? "new" : null);
  const routeKey = routeTarget === "new" ? "novo" : (routeTarget?.id ?? "");
  const [target, setTarget] = useState<Quote | "new" | null>(routeTarget);
  const [seenRoute, setSeenRoute] = useState(routeKey);
  if (seenRoute !== routeKey) {
    setSeenRoute(routeKey);
    setTarget(routeTarget);
  }
  const closeEditorRef = useRef<(() => void) | null>(null);

  const pathOf = (next: Quote | "new" | null) => (next === null ? LIST_PATH : next === "new" ? NEW_PATH : `${LIST_PATH}/${next.id}`);

  const showEditor = useCallback((next: Quote | "new" | null) => {
    setTarget(next);
    window.history.pushState(null, "", `${pathOf(next)}${window.location.search}`);
  }, []);

  const items = page.items;
  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      if (path === NEW_PATH) return setTarget("new");
      if (path === LIST_PATH) return setTarget(null);
      const id = path.slice(LIST_PATH.length + 1);
      const quote = items.find((entry) => entry.id === id) ?? (editing?.id === id ? editing : undefined);
      // O orçamento que não está na página da lista vem do servidor, pela página dele.
      if (quote) setTarget(quote);
      else router.refresh();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [items, editing, router]);

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
  // valer no clique. A tabela é coisa de desktop: no celular vale sempre o funil.
  const [view, setView] = useState<QuotesView>(saved);
  const asTable = view === "tabela" && !mobile;

  useEffect(() => () => window.clearTimeout(typing.current), []);

  /* Abrir um orçamento, ou gerar um novo, é abrir a janela do editor sobre a lista (2026-10-26). */
  const openEditor = useCallback((next: Quote | "new") => showEditor(next), [showEditor]);

  /* `go` lê `live` por uma ref, e não pela variável do fechamento: a busca com espera agenda uma chamada
     num `setTimeout` que só dispara depois, e se `live` mudasse nesse intervalo (por exemplo, a pessoa
     escolheu um filtro no menu enquanto a espera corria) a chamada tardia reconstruía a URL a partir do
     `live` velho, apagando o filtro escolhido. Com a ref, `go` fica estável e sempre lê o estado mais
     recente, o que também dispensa recalcular tudo que depende dela a cada tecla. */
  const liveRef = useRef(live);
  useEffect(() => {
    liveRef.current = live;
  }, [live]);

  const go = useCallback(
    (next: Partial<QuotesQuery>) => {
      const merged = { ...liveRef.current, ...next };
      setLive(merged);
      const params = new URLSearchParams();
      if (merged.search) params.set(QUERY_PARAM, merged.search);
      if (merged.status !== defaultQuery.status) params.set(STATUS_PARAM, merged.status);
      if (merged.period !== defaultQuery.period) params.set(PERIOD_PARAM, merged.period);
      if (merged.page > 1) params.set(PAGE_PARAM, String(merged.page));
      /* O tamanho padrão de cada visão (30 na tabela, 100 no funil) fica fora da URL: o servidor já o sabe pelo
         cookie da visão. */
      if (merged.pageSize !== QUOTES_PER_PAGE && merged.pageSize !== FUNNEL_PER_PAGE) params.set(PAGE_SIZE_PARAM, String(merged.pageSize));

      const search = params.toString();
      /* O filtro mantém o endereço em que a pessoa está: com a janela do editor aberta ele é `/orcamentos/novo`
         ou `/orcamentos/<id>`, e trocar para `/orcamentos` fechava a janela junto (2026-10-26, correção: no
         celular a troca do tamanho da página fechava o gerar assim que ele abria). */
      const base = window.location.pathname.startsWith(LIST_PATH) ? window.location.pathname : LIST_PATH;
      startTransition(() => router.replace((search ? `${base}?${search}` : base) as Route, { scroll: false }));
    },
    [router],
  );

  const changeView = (next: QuotesView) => {
    setView(next);
    saveQuotesView(next);
    const pageSize = next === "tabela" ? QUOTES_PER_PAGE : FUNNEL_PER_PAGE;
    if (pageSize !== live.pageSize) go({ pageSize, page: remapPage(live.page, live.pageSize, pageSize) });
  };

  // Cada visão pede ao servidor a página da medida dela: trinta na tabela e cem no funil, que mostra as etapas
  // de uma vez (2026-10-26, no lugar da grade que media as colunas). A troca só pede outra página quando o
  // tamanho muda de verdade.
  const currentSize = live.pageSize;
  const currentPage = live.page;
  useEffect(() => {
    const size = asTable ? QUOTES_PER_PAGE : FUNNEL_PER_PAGE;
    if (size === currentSize) return;
    const timer = window.setTimeout(() => go({ pageSize: size, page: remapPage(currentPage, currentSize, size) }), RESIZE_PAUSE);
    return () => window.clearTimeout(timer);
  }, [asTable, currentSize, currentPage, go]);

  const onSearch = (value: string) => {
    setSearch(value);
    window.clearTimeout(typing.current);
    typing.current = window.setTimeout(() => go({ search: value, page: 1 }), TYPING_PAUSE);
  };

  // Trocar de página leva de volta ao começo da lista: no desktop quem rola é a área da grade, e no celular a
  // coluna de conteúdo da concha, então o alvo é o primeiro dos dois que de fato tenha o que rolar.
  const scrollArea = useRef<HTMLDivElement>(null);
  const changePage = useCallback(
    (next: number) => {
      go({ page: next });
      const area = scrollArea.current;
      const column = (area && area.scrollHeight > area.clientHeight ? area : null) ?? document.querySelector<HTMLElement>(`[${SCROLL_CONTAINER}]`) ?? document.documentElement;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      column.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    },
    [go],
  );

  const pages = Math.max(1, Math.ceil(page.total / live.pageSize));
  const from = (live.page - 1) * live.pageSize + 1;
  const to = Math.min(live.page * live.pageSize, page.total);
  const active = activeQuotesFilters(live);
  const filtering = Boolean(live.search) || active.length > 0;
  /* Uma página deixa de existir quando o último item dela some (exclusão, ou filtro que encolheu a base): a
     URL continua pedindo, por exemplo, a página 3 de uma lista que agora só tem 2. Sem isto o servidor
     devolvia zero itens com `total` correto e a tela ficava presa ali, sem paginação, dizendo que não havia
     orçamento nenhum. */
  useEffect(() => {
    if (live.page > pages) go({ page: pages });
  }, [live.page, pages, go]);
  const pastEnd = page.total > 0 && page.items.length === 0;
  /* Limpar leva a busca junto dos filtros: no vazio a pessoa quer a lista de volta inteira, e não metade. */
  const clearAll = () => {
    setSearch("");
    go({ ...clearedFilters, search: "", page: 1 });
  };

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

  /* `range`, `pagination` e `cards` memorizados: sem isto, cada tecla no campo de busca recriava esses
     valores com identidade nova a cada render, e mesmo `QuotesTable` e `QuoteCard` memorizados refariam o
     trabalho por dentro, porque suas propriedades pareceriam diferentes a cada vez. */
  const range = useMemo(() => ({ page: live.page, pageSize: live.pageSize, total: page.total }), [live.page, live.pageSize, page.total]);

  const pagination = useMemo(
    () =>
      pages > 1 && !mobile ? (
        <Pagination page={live.page} pageSize={live.pageSize} total={page.total} onPageChange={changePage} label="Páginas de orçamentos" />
      ) : undefined,
    [pages, mobile, live.page, live.pageSize, page.total, changePage],
  );

  /* `QuoteCard` mora em `quote-card.tsx`, fora deste lote: não dá para embrulhá-lo em `React.memo` por
     dentro. Memorizar a lista pronta tem o mesmo efeito, porque o React reaproveita elementos que chegam
     com a mesma referência: enquanto `page.items` e `openEditor` não mudarem, o corpo de cada cartão não
     roda de novo. */

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
        <QuotesTable quotes={page.items} onOpen={openEditor} range={range} footer={pagination} />
      ) : page.items.length === 0 ? (
        <EmptyState
          icon={ReceiptIcon}
          title={pastEnd ? "Essa página não existe mais" : filtering ? "Nenhum orçamento encontrado" : "Nenhum orçamento ainda"}
          description={
            pastEnd
              ? "Algo saiu da lista e a página ficou para trás. Levando você para a última."
              : filtering
                ? "Nada bateu com o que você procurou. Tente outro número, título ou cliente, ou limpe a busca."
                : "Gere o primeiro orçamento e mande ao cliente por link, sem anexo e sem PDF perdido no e-mail."
          }
        >
          {!pastEnd && filtering && (
            <Button variant="secondary" size="sm" radius="md" iconStart={<ArrowCounterClockwiseIcon />} onClick={clearAll}>
              Limpar busca
            </Button>
          )}
          {!pastEnd && (
            <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => openEditor("new")}>
              Novo orçamento
            </Button>
          )}
        </EmptyState>
      ) : (
        <div ref={scrollArea} className={styles.funnel}>
          <QuotesFunnel quotes={page.items} onOpen={openEditor} />
        </div>
      )}

      {/* O pé do funil, preso embaixo e à direita no desktop, como no catálogo: a contagem e, passando de uma
          página, a barra. Na tabela ele mora no pé da própria tabela.

          A condição olha `page.total`, e não `page.items.length`: uma página que ficou para trás do fim
          (o efeito acima já está levando de volta) tem itens vazios com total maior que zero, e o pé
          precisa continuar visível, com a barra, para a pessoa não ficar presa numa tela sem paginação. */}
      {!asTable && page.total > 0 && (
        <div className={styles.foot}>
          <Text as="span" variant="footnote" tone="secondary">
            {pastEnd ? "Ajustando a página" : `Mostrando ${numberFormat.format(from)} a ${numberFormat.format(to)} de ${numberFormat.format(page.total)}`}
          </Text>
          {pagination}
        </div>
      )}

      {/* A janela de gerar: a de trabalho da casa, quase a tela inteira, com o editor de sempre por dentro. O
          Escape e o toque fora passam pela pergunta do editor, que só fecha direto quando nada foi mexido. */}
      <Dialog
        open={target !== null}
        onClose={() => (closeEditorRef.current ? closeEditorRef.current() : showEditor(null))}
        label={target && target !== "new" ? `Orçamento ${target.number}` : "Novo orçamento"}
        size="xl"
        surface="solid"
        focusOnOpen={false}
      >
        {target !== null && (
          <QuoteEditor
            key={target === "new" ? "new" : target.id}
            quote={target === "new" ? undefined : target}
            clients={editor.clients}
            catalog={editor.catalog}
            issuer={editor.issuer}
            owner={editor.owner}
            nextNumber={editor.nextNumber}
            prefill={target === "new" ? prefill : undefined}
            closeRef={closeEditorRef}
            onLeave={() => showEditor(null)}
            onSaved={() => {
              showEditor(null);
              router.refresh();
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
