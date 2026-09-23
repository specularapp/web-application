"use client";

import {
  AddressBookIcon,
  ArrowCounterClockwiseIcon,
  EnvelopeSimpleIcon,
  ListBulletsIcon,
  MinusCircleIcon,
  PhoneIcon,
  PlusIcon,
  SquaresFourIcon,
  StarIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useFloatingPagerRegistration } from "@/components/layout/floating-actions";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import type { DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Pagination } from "@/components/ui/pagination";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/providers/toast-provider";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { useTabList } from "@/hooks/use-tab-list";
import { useOpenedOnce } from "@/hooks/use-opened-once";
import { callAction } from "@/lib/action";
import { SCROLL_CONTAINER } from "@/lib/scroll";
import { remapPage } from "@/lib/utils/paging";
import { ConfirmDialog, confirmNames } from "@/components/ui/confirm-dialog";
import { deleteClientsAction } from "../actions";
import {
  CLIENTS_PER_PAGE,
  EMAIL_PARAM,
  FAVORITE_PARAM,
  GRID_PER_PAGE_DEFAULT,
  GROUP_PARAM,
  MOBILE_PER_PAGE,
  PAGE_PARAM,
  PAGE_SIZE_PARAM,
  PERIOD_PARAM,
  PHONE_PARAM,
  QUERY_PARAM,
  STATUS_PARAM,
  activeClientsFilters,
  clearedFilters,
  defaultQuery,
  gridPageSize,
  periodOptions,
  type ClientListItem,
  type ClientsListPage,
  type ClientsQuery,
} from "../list-options";
import type { Client } from "../summary";
import { saveClientsGridSize, saveClientsView, type ClientsView } from "../view-cookie";
import { ClientCard } from "./client-card";
import type { ClientEditor } from "./client-form-dialog";
import { ClientsTable } from "./clients-table";

import styles from "./clients-board.module.css";

/* As duas filas de contato, na ordem em que a seta do teclado as percorre. */
const CONTACT_GROUPS = ["clientes", "fornecedores"] as const;

/* A ficha e o formulário entram por importação dinâmica, e só são montados depois da primeira abertura
   (varredura de peso de 2026-09-21): juntos são mais de setecentas linhas com máscara, seletor de data e
   etiquetas, e a listagem abria carregando os dois sem ninguém ter clicado em nada. */
const ClientDrawer = dynamic(() => import("./client-drawer").then((module) => module.ClientDrawer));
const ClientFormDialog = dynamic(() => import("./client-form-dialog").then((module) => module.ClientFormDialog));

export type ClientsBoardProps = {
  page: ClientsListPage;
  query: ClientsQuery;
  editing?: Client | "new";
  /** O jeito de ver que o cookie guardou: grade de cartões ou tabela. */
  view: ClientsView;
};

/** Quanto o campo espera parar de digitar antes de refazer a busca no servidor. */
const TYPING_PAUSE = 320;

/** Quanto a grade espera a janela parar de mudar de largura antes de pedir outro tamanho de página. */
const RESIZE_PAUSE = 200;

const numberFormat = new Intl.NumberFormat("pt-BR");

/* O endereço de cada estado da janela. Fora do componente porque só depende do que recebe, e é o que deixa
   `go` valer para qualquer render sem virar dependência dele. */
const editorPath = (next: ClientEditor) => (next === null ? "/clientes" : next === "new" ? "/clientes/novo" : `/clientes/${next.id}`);

/* Os dois jeitos de ver a mesma lista, no seletor da barra. */
const viewOptions = [
  { value: "grade", label: "Ver em grade", icon: <SquaresFourIcon /> },
  { value: "tabela", label: "Ver em tabela", icon: <ListBulletsIcon /> },
];

// A tela de clientes: a barra de busca e filtros em cima, a grade de cartões ou a tabela no meio e a
// paginação embaixo, presa no pé no desktop, como no catálogo (2026-09-08). O filtro vive na URL e quem faz o
// trabalho é o servidor, então a página é compartilhável e volta igual pelo histórico do navegador; aqui
// ficam só a seleção, que é da sessão e vale para cartões e tabela, a espera do campo de busca, o filtro
// adiantado, o jeito de ver e o tamanho da página da grade. Trocar qualquer filtro leva de volta para a
// primeira página, senão a pessoa cairia numa página que o novo filtro nem tem.
export function ClientsBoard({ page, query, editing, view: saved }: ClientsBoardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState(query.search);
  // O filtro em vigor na tela, adiantado: a escolha marca na hora e a URL vai atrás, senão o check só
  // aparecia quando o servidor devolvia a página, e a lista parecia lenta. Quando a resposta chega, o que
  // veio da URL passa a valer, ajustado durante o render, que é como o React pede para reagir a prop nova.
  const [live, setLive] = useState(query);
  const [seen, setSeen] = useState(query);
  if (seen !== query) {
    setSeen(query);
    setLive(query);
  }
  // `go` lê o filtro em vigor daqui, e não da closure do render em que foi chamado: a espera da digitação e
  // a medida da grade gravam a URL depois, e partindo do filtro velho desfariam a escolha feita no meio
  // (ligar "Só favoritos" durante a espera do campo de busca apagava o favorito da URL).
  const liveRef = useRef(live);
  // Quem está marcado, para excluir de uma vez. A seleção é desta página: trocar filtro ou página a limpa,
  // senão a pessoa excluiria alguém que já não está vendo.
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const items = page.items.filter((client) => !hidden.includes(client.id));
  const hiddenOnPage = page.items.length - items.length;
  const total = Math.max(0, page.total - hiddenOnPage);
  // Uma gaveta só para a tela inteira, guardando quem está aberto: assim trinta cartões não montam trinta
  // janelas. Fica montada e vazia depois de fechar, para a saída animar.
  const [open, setOpen] = useState<ClientListItem | null>(null);
  // A ficha em edição na janela. Nasce do que a URL pediu (`/clientes/novo` ou `/clientes/<id>`), e daí em
  // diante troca só a URL, sem sair da tela: `pushState` conversa com o roteador sem refazer nada no
  // servidor, e o botão de voltar do navegador fecha, ou reabre quem estava aberto, pelo `popstate`.
  const [editor, setEditor] = useState<ClientEditor>(editing ?? null);
  // A janela que a rota pede volta a valer sempre que a rota troca de endereço, no mesmo desenho da prancha
  // de contratos: sem isto, uma resposta nova do servidor não reabria nada, porque a prancha não remonta
  // quando só o parâmetro da rota muda, e o `editing` só alimentava o estado inicial.
  //
  // A comparação é por endereço, e não pela ficha: um `router.refresh()` depois de salvar traz outra ficha no
  // mesmo endereço e não pode reabrir a janela que acabou de fechar. E quando a janela já mostra o que a
  // rota pede, nada é trocado: gravar a URL com a janela aberta (filtro, busca, paginação) leva a rota para
  // o endereço dela, e refazer o estado ali dentro jogaria fora o que a pessoa já digitou no formulário.
  const routeKey = editing === "new" ? "novo" : (editing?.id ?? "");
  const editorKey = editor === "new" ? "novo" : (editor?.id ?? "");
  const [seenRoute, setSeenRoute] = useState(routeKey);
  if (seenRoute !== routeKey) {
    setSeenRoute(routeKey);
    if (routeKey !== editorKey) setEditor(editing ?? null);
  }
  /* Pelo mesmo motivo do filtro: uma gravação atrasada da URL precisa do endereço da janela que está aberta
     agora, senão levaria a barra de endereço de volta para a lista com a janela na tela. */
  const editorRef = useRef(editor);
  useEffect(() => {
    liveRef.current = live;
    editorRef.current = editor;
  }, [live, editor]);
  /* As duas janelas nascem só na primeira abertura, e seguem montadas depois, para a saída animar. */
  const drawerReady = useOpenedOnce(open !== null);
  const editorReady = useOpenedOnce(editor !== null);
  // O jeito de ver vive em cookie, então o servidor já manda a página certa; o estado aqui é só para a
  // troca valer no clique. A tabela é coisa de desktop: no celular a grade vale sempre.
  const [view, setView] = useState<ClientsView>(saved);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const asTable = view === "tabela" && !mobile;
  // O último tamanho que a grade mediu, para a troca de visão já pedir o tamanho certo sem esperar a medida.
  const gridSize = useRef<number>(GRID_PER_PAGE_DEFAULT);
  const typing = useRef<number | undefined>(undefined);

  // O ouvinte é refeito a cada página de itens, porque é entre eles que o endereço do voltar é procurado,
  // no mesmo desenho da prancha de projetos e de contratos: quem está na tela reabre na hora, e um id que
  // não está nesta página vai pelo roteador, que é quem sabe buscar a ficha. Sem isso, o voltar deixava a
  // barra de endereço numa ficha sem nenhuma janela aberta.
  useEffect(() => {
    const onPopState = () => {
      // O voltar do navegador também sai da listagem, e aí o endereço restaurado é de outra tela: sem esta
      // conferência, qualquer caminho de dois segmentos (/cobrancas/<id>, /projetos/<id>) entrava aqui como
      // se o segundo pedaço fosse um contato, e a prancha, que ainda está no ar até a troca comitar, mandava
      // o roteador de novo para o endereço da outra tela.
      const [, area, segment] = window.location.pathname.split("/");
      if (area !== "clientes") return;
      if (segment === "novo") {
        setOpen(null);
        setEditor("new");
        return;
      }
      /* Quem acabou de ser excluído aqui só fecha: mandar ao roteador cairia na página de não encontrado. */
      const gone = Boolean(segment && hidden.includes(segment));
      const item = segment && !gone ? page.items.find((client) => client.id === segment) : undefined;
      /* A ficha que a rota trouxe conta tanto quanto as desta página: quem abriu por link ou recarregou está
         numa rota /clientes/<id> cujo contato costuma estar fora da página de itens, e sem isto o voltar
         pedia ao roteador o endereço que o navegador já tinha restaurado, o que não reabre nada. */
      const fromRoute = editing && editing !== "new" && editing.id === segment ? editing : undefined;
      const target = item ?? fromRoute;
      /* O endereço da janela nasceu com a gaveta de ficha fechada, e voltar para ele devolve esse estado. */
      if (target) setOpen(null);
      setEditor(target ?? null);
      if (segment && !gone && !target) {
        /* Sem rolagem, como em `go`: a lista restaurada fica onde estava. */
        startTransition(() => router.replace(`${window.location.pathname}${window.location.search}` as Route, { scroll: false }));
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [page.items, hidden, editing, router]);

  // Editar quem já está na tela abre no lugar, com a ficha completa chegando dentro da gaveta: sem ida
  // ao servidor pela página, o que era o que deixava o clique sem resposta.
  const editClient = (item: ClientListItem) => {
    setOpen(null);
    openEditor(item);
  };

  const openEditor = (next: ClientEditor) => {
    setEditor(next);
    window.history.pushState(null, "", `${editorPath(next)}${window.location.search}`);
  };

  useEffect(() => () => window.clearTimeout(typing.current), []);

  const go = useCallback(
    (next: Partial<ClientsQuery>) => {
      const merged = { ...liveRef.current, ...next };
      setLive(merged);
      setSelected([]);
      const params = new URLSearchParams();
      if (merged.group !== defaultQuery.group) params.set(GROUP_PARAM, merged.group);
      if (merged.search) params.set(QUERY_PARAM, merged.search);
      if (merged.favorite !== defaultQuery.favorite) params.set(FAVORITE_PARAM, merged.favorite);
      if (merged.status !== defaultQuery.status) params.set(STATUS_PARAM, merged.status);
      if (merged.period !== defaultQuery.period) params.set(PERIOD_PARAM, merged.period);
      if (merged.withEmail) params.set(EMAIL_PARAM, "1");
      if (merged.withPhone) params.set(PHONE_PARAM, "1");
      if (merged.page > 1) params.set(PAGE_PARAM, String(merged.page));
      if (merged.pageSize !== CLIENTS_PER_PAGE) params.set(PAGE_SIZE_PARAM, String(merged.pageSize));

      const search = params.toString();
      const base = editorPath(editorRef.current);
      startTransition(() => router.replace((search ? `${base}?${search}` : base) as Route, { scroll: false }));
    },
    [router],
  );

  const changeView = (next: ClientsView) => {
    setView(next);
    saveClientsView(next);
    const pageSize = next === "tabela" ? CLIENTS_PER_PAGE : gridSize.current;
    if (pageSize !== live.pageSize) go({ pageSize, page: remapPage(live.page, live.pageSize, pageSize) });
  };

  // Cada tecla refaz a página no servidor, então o campo espera a pessoa parar de digitar: sem isso
  // seria uma ida ao servidor por letra.
  const onSearch = (value: string) => {
    setSearch(value);
    window.clearTimeout(typing.current);
    typing.current = window.setTimeout(() => go({ search: value, page: 1 }), TYPING_PAUSE);
  };

  const toggle = (id: string, on: boolean) =>
    setSelected((current) => (on ? [...current, id] : current.filter((entry) => entry !== id)));

  // Trocar de página leva de volta ao começo da lista: no desktop quem rola é a área da grade, e no celular
  // a coluna de conteúdo da concha, e não o documento, então o `scroll` do roteador não os alcança. Macio,
  // salvo com movimento reduzido.
  const scrollArea = useRef<HTMLDivElement>(null);
  const changePage = (next: number) => {
    go({ page: next });
    // No desktop quem rola é a área da grade; no celular ela cresce em fluxo e quem rola é a coluna da
    // concha, então o alvo é o primeiro dos dois que de fato tenha o que rolar.
    const area = scrollArea.current;
    const column = (area && area.scrollHeight > area.clientHeight ? area : null) ?? document.querySelector<HTMLElement>(`[${SCROLL_CONTAINER}]`) ?? document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    column.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  // A grade mede quantas colunas formou e pede ao servidor a página que cabe em três linhas, sempre par, na
  // mesma receita do catálogo. As colunas saem da lista de trilhas já resolvida pelo navegador, então valem
  // para o `auto-fill`. A medida entra no cookie para a próxima visita já vir do tamanho certo, e só pede
  // outra página quando o tamanho muda de verdade, depois de a janela parar de mudar.
  const gridRef = useRef<HTMLUListElement>(null);
  const showing = items.length;
  const currentSize = live.pageSize;
  const currentPage = live.page;
  useEffect(() => {
    const grid = gridRef.current;
    if (asTable || !grid) return;
    let timer: number | undefined;
    const observer = new ResizeObserver(() => {
      // No celular a página é sempre doze, e não o que a grade mede: numa ou duas colunas a medida daria
      // três ou seis, e a pessoa passaria página o tempo todo. No desktop vale o que cabe em três linhas.
      const columns = getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length;
      const size = mobile ? MOBILE_PER_PAGE : gridPageSize(columns);
      gridSize.current = size;
      // O cookie guarda só a medida do desktop: é ele que faz a primeira página vir do tamanho certo na
      // visita seguinte, e o doze fixo do celular gravado ali faria o desktop abrir curto antes de medir.
      if (!mobile) saveClientsGridSize(size);
      window.clearTimeout(timer);
      if (size === currentSize) return;
      timer = window.setTimeout(() => go({ pageSize: size, page: remapPage(currentPage, currentSize, size) }), RESIZE_PAUSE);
    });
    observer.observe(grid);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [asTable, mobile, showing, currentSize, currentPage, go]);


  const pages = Math.max(1, Math.ceil(total / live.pageSize));
  const from = (live.page - 1) * live.pageSize + 1;
  const to = Math.min(live.page * live.pageSize, total);
  const active = activeClientsFilters(live);
  /* Sem busca e sem filtro, uma lista vazia quer dizer base vazia: é a diferença entre convidar a cadastrar o
     primeiro e dizer que a procura não achou nada. */
  const filtering = Boolean(live.search) || active.length > 0;
  const clearAll = () => {
    setSearch("");
    go({ ...clearedFilters, search: "", page: 1 });
  };
  const selectedClients = items.filter((client) => selected.includes(client.id));
  const count = selectedClients.length;
  const suppliers = live.group === "fornecedores";
  const singular = suppliers ? "fornecedor" : "cliente";
  const plural = suppliers ? "fornecedores" : "clientes";
  const groupTabs = useTabList(CONTACT_GROUPS, suppliers ? "fornecedores" : "clientes", (group) => go({ group, page: 1 }));

  // Excluir de uma vez: a action valida no servidor e devolve a contagem; a tela avisa, limpa a marcação
  // e refaz a lista. Hoje a base é a prévia, então nada some de verdade; com a tabela, some.
  const removeSelected = async () => {
    const targets = selectedClients;
    const ids = targets.map((client) => client.id);
    setHidden((current) => [...new Set([...current, ...ids])]);
    setConfirming(false);
    setSelected([]);
    setDeleting(true);
    const result = await callAction(deleteClientsAction(ids));
    setDeleting(false);

    if (!result.ok) {
      setHidden((current) => current.filter((id) => !ids.includes(id)));
      toast({ title: "Não deu para excluir", description: result.error, tone: "danger" });
      return;
    }

    toast({
      title: result.deleted === 1 ? "Cliente excluído" : `${result.deleted} clientes excluídos`,
      description: "A base já está sem eles.",
      tone: "success",
      feedback: {
        visual: targets.length === 1 ? (
          <Avatar name={targets[0].name} src={targets[0].avatarUrl ?? undefined} size="lg" shape="rounded" />
        ) : (
          <AvatarGroup>
            {targets.slice(0, 3).map((client) => (
              <Avatar key={client.id} name={client.name} src={client.avatarUrl ?? undefined} size="md" shape="rounded" />
            ))}
          </AvatarGroup>
        ),
        confetti: false,
      },
    });
  };

  /* O menu de filtros, tudo num lugar só e só o que é útil (a pedido, 2026-09-08): período em escolha
     única, marcada pelo check; favorito e inativo em interruptor, porque são sim ou não; e-mail e
     telefone também. Ordem e "só ativos" saíram por não mudarem nada no dia a dia. Cada escolha vale na hora e não fecha o menu, porque a pessoa costuma ajustar mais
     de uma coisa antes de sair; limpar volta tudo ao padrão e só aparece com algo em vigor. */
  const filterSections: DropdownSection[] = [
    {
      id: "period",
      label: "Período de entrada",
      items: periodOptions.map((option) => ({
        id: `period-${option.value}`,
        label: option.label,
        selected: live.period === option.value,
        keepOpen: true,
        onSelect: () => go({ period: option.value, page: 1 }),
      })),
    },
    {
      id: "client",
      label: "Cliente",
      items: [
        {
          kind: "toggle",
          id: "favorite",
          label: "Só favoritos",
          icon: StarIcon,
          checked: live.favorite === "favoritos",
          onChange: (on) => go({ favorite: on ? "favoritos" : "todos", page: 1 }),
        },
        /* Só o que muda a lista de verdade: quase todo mundo é ativo, então o filtro útil é o de inativos. */
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
    {
      id: "contact",
      label: "Contato",
      items: [
        {
          kind: "toggle",
          id: "email",
          label: "Com e-mail",
          icon: EnvelopeSimpleIcon,
          checked: live.withEmail,
          onChange: (withEmail) => go({ withEmail, page: 1 }),
        },
        {
          kind: "toggle",
          id: "phone",
          label: "Com telefone",
          icon: PhoneIcon,
          checked: live.withPhone,
          onChange: (withPhone) => go({ withPhone, page: 1 }),
        },
      ],
    },
    ...(active.length > 0
      ? [{ id: "reset", items: [{ id: "reset", label: "Limpar filtros", icon: ArrowCounterClockwiseIcon, onSelect: () => go(clearedFilters) }] }]
      : []),
  ];

  // No celular a paginação mora na barra flutuante do menu, junto do botão que abre a tela cheia, em vez de
  // uma segunda barra no pé da lista: é o mesmo lugar de salvar e sair de uma janela, e a lista rola até o
  // fim sem nada por cima. Passando de uma página; com uma só, a barra volta a ser busca e sino.
  useFloatingPagerRegistration(mobile && pages > 1 ? { page: live.page, pageCount: pages, onPageChange: changePage, label: `Páginas de ${plural}` } : null);

  const pagination =
    pages > 1 && !mobile ? <Pagination page={live.page} pageSize={live.pageSize} total={total} onPageChange={changePage} label={`Páginas de ${plural}`} /> : undefined;

  return (
    <div className={styles.board}>
      <PageToolbar
        search={{
          value: search,
          onChange: onSearch,
          placeholder: `Buscar ${plural}`,
          label: `Buscar ${singular}`,
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
        selection={
          /* Só existe com algo marcado: botão que não faz nada é pior que botão nenhum. Texto com a
             contagem no desktop e só o ícone no celular, com a contagem no nome. */
          count > 0 && (
            <>
              <span className={styles.wide}>
                <Button variant="danger" size="sm" radius="md" iconStart={<TrashIcon />} onClick={() => setConfirming(true)}>
                  Excluir {count}
                </Button>
              </span>
              <span className={styles.narrow}>
                <IconButton label={`Excluir ${count} selecionados`} variant="danger" size="sm" radius="md" onClick={() => setConfirming(true)}>
                  <TrashIcon />
                </IconButton>
              </span>
            </>
          )
        }
        action={
          <>
            <span className={styles.wide}>
              <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => openEditor("new")}>
                Novo {singular}
              </Button>
            </span>
            <span className={styles.narrow}>
              <IconButton label={`Novo ${singular}`} size="sm" radius="md" onClick={() => openEditor("new")}>
                <PlusIcon />
              </IconButton>
            </span>
          </>
        }
      />

      <div className={styles.groups} aria-label="Tipo de contato" {...groupTabs.listProps}>
        <button type="button" className={styles.group} {...groupTabs.tabProps("clientes")} onClick={() => go({ group: "clientes", page: 1 })}>
          Clientes
        </button>
        <button type="button" className={styles.group} {...groupTabs.tabProps("fornecedores")} onClick={() => go({ group: "fornecedores", page: 1 })}>
          Fornecedores
        </button>
      </div>

      {asTable ? (
        <ClientsTable
          clients={items}
          group={live.group}
          selected={selected}
          onSelectedChange={setSelected}
          onOpen={setOpen}
          onEdit={editClient}
          range={{ page: live.page, pageSize: live.pageSize, total }}
          footer={pagination}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={AddressBookIcon}
          title={filtering ? `Nenhum ${singular} encontrado` : `Nenhum ${singular} ainda`}
          description={
            filtering
              ? "Nada bateu com o que você procurou. Tente outro nome, empresa, e-mail ou telefone, ou limpe a busca."
              : suppliers
                ? "Cadastre o primeiro fornecedor para ligar despesas, pagamentos e o histórico dessa relação."
                : "Cadastre o primeiro cliente e o histórico de orçamentos, contratos e cobranças dele passa a viver aqui."
          }
        >
          {filtering && (
            <Button variant="secondary" size="sm" radius="md" iconStart={<ArrowCounterClockwiseIcon />} onClick={clearAll}>
              Limpar busca
            </Button>
          )}
          <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => openEditor("new")}>
            Novo {singular}
          </Button>
        </EmptyState>
      ) : (
        <div ref={scrollArea} className={styles.scrollArea}>
          <ul ref={gridRef} className={styles.grid}>
            {items.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                selected={selected.includes(client.id)}
                onSelectedChange={(on) => toggle(client.id, on)}
                onOpen={() => setOpen(client)}
                onEdit={() => editClient(client)}
              />
            ))}
          </ul>
        </div>
      )}

      {/* O pé da grade, preso embaixo e à direita no desktop, como no catálogo: a contagem e, passando de uma
          página, a barra. Na tabela ele mora no pé da própria tabela. */}
      {!asTable && items.length > 0 && (
        <div className={styles.foot}>
          <Text as="span" variant="footnote" tone="secondary">
            Mostrando {numberFormat.format(from)} a {numberFormat.format(to)} de {numberFormat.format(total)}
          </Text>
          {pagination}
        </div>
      )}

      {drawerReady && <ClientDrawer client={open} onClose={() => setOpen(null)} onEdit={() => open && editClient(open)} />}
      <ConfirmDialog
        open={confirming}
        pending={deleting}
        title={selectedClients.length > 1 ? `Excluir ${selectedClients.length} clientes?` : "Excluir este cliente?"}
        description={`${confirmNames(selectedClients.map((client) => client.name))} ${selectedClients.length > 1 ? "saem" : "sai"} da base com os orçamentos e projetos ligados. Isso não pode ser desfeito.`}
        faces={selectedClients.map((client) => ({ id: client.id, name: client.name, avatarUrl: client.avatarUrl, seed: client.email }))}
        onClose={() => setConfirming(false)}
        onConfirm={removeSelected}
      />
      {editorReady && (
        <ClientFormDialog
          editor={editor}
          defaultKind={suppliers ? "supplier" : "customer"}
          onClose={() => openEditor(null)}
          onSaved={() => {
            openEditor(null);
            startTransition(() => router.refresh());
          }}
        />
      )}
    </div>
  );
}
