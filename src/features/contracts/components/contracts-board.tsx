"use client";

import { ArrowCounterClockwiseIcon, KanbanIcon, ListBulletsIcon, PlusIcon, SignatureIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFloatingPagerRegistration } from "@/components/layout/floating-actions";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import type { DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Pagination } from "@/components/ui/pagination";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { useOpenedOnce } from "@/hooks/use-opened-once";
import { callAction } from "@/lib/action";
import { cancelContractAction, sendContractAction } from "../actions";
import { contractSources, contractStatuses } from "../labels";
import {
  CONTRACTS_PER_PAGE,
  FUNNEL_PER_PAGE,
  KIND_PARAM,
  PAGE_PARAM,
  PAGE_SIZE_PARAM,
  QUERY_PARAM,
  SOURCE_PARAM,
  STATUS_PARAM,
  activeContractsFilters,
  clearedFilters,
  defaultQuery,
  kindFilterLabels,
  kindFilterValues,
  remapPage,
  sourceFilterLabels,
  sourceFilterValues,
  statusFilterLabels,
  statusFilterValues,
  type ContractsListPage,
  type ContractsQuery,
} from "../list-options";
import type { ContractLookups } from "../service";
import type { Contract } from "../summary";
import { saveContractsView, type ContractsView } from "../view-cookie";
import { ContractsFunnel, type ContractActionsFor } from "./contracts-funnel";
import { ContractsTable } from "./contracts-table";
import styles from "./contracts-board.module.css";

/* A ficha, o editor e o novo contrato entram por importação dinâmica, montados só na primeira abertura
   (varredura de peso de 2026-09-21): a listagem não precisa do visualizador de documento nem do Tiptap para
   desenhar a lista. */
const ContractDialog = dynamic(() => import("./contract-dialog").then((module) => module.ContractDialog));
const ContractEditor = dynamic(() => import("./contract-editor").then((module) => module.ContractEditor));
const NewContractDialog = dynamic(() => import("./new-contract-dialog").then((module) => module.NewContractDialog));

export type ContractsBoardProps = {
  page: ContractsListPage;
  query: ContractsQuery;
  /** O jeito de ver que o cookie guardou: o funil por situação ou a tabela. */
  view: ContractsView;
  /** As bases que o editor oferece na janela: clientes, projetos e orçamentos aprovados. */
  lookups: ContractLookups;
  /** Se a reescrita por IA está configurada. */
  aiAvailable: boolean;
  /** O contrato que a URL pede aberto na ficha (`/contratos/<id>`). */
  viewing?: Contract | null;
  /** O rascunho que a URL pede aberto no editor (`/contratos/<id>/editar`). */
  editing?: Contract | null;
  /** A janela de criar já aberta, quando a URL é `/contratos/novo`. */
  creating?: boolean;
  /** O que a URL manda preencher na janela de criar: hoje o cliente, vindo do leque da ficha dele. */
  prefill?: { clientId?: string };
};

/** O que está aberto sobre a lista: a ficha de um contrato, o editor de um rascunho ou a janela de criar. */
type Target = { kind: "view"; contract: Contract } | { kind: "edit"; contract: Contract } | { kind: "new" } | null;

const LIST_PATH = "/contratos";

/** Quanto o campo espera parar de digitar antes de refazer a busca no servidor. */
const TYPING_PAUSE = 320;

/** Quanto a prancha espera antes de pedir a página na medida da outra visão. */
const RESIZE_PAUSE = 200;

/* Os dois jeitos de ver a mesma lista, no seletor da barra: o funil primeiro, porque é o padrão daqui. */
const viewOptions = [
  { value: "funil", label: "Ver em etapas", icon: <KanbanIcon /> },
  { value: "tabela", label: "Ver em tabela", icon: <ListBulletsIcon /> },
];

/** O endereço da tela conforme o que está aberto. */
const pathOf = (target: Target) =>
  target === null ? LIST_PATH : target.kind === "new" ? `${LIST_PATH}/novo` : target.kind === "edit" ? `${LIST_PATH}/${target.contract.id}/editar` : `${LIST_PATH}/${target.contract.id}`;

const routeOf = (viewing?: Contract | null, editing?: Contract | null, creating?: boolean): Target =>
  editing ? { kind: "edit", contract: editing } : viewing ? { kind: "view", contract: viewing } : creating ? { kind: "new" } : null;

/* Um clique e o arquivo desce: a rota devolve o PDF pronto com `Content-Disposition`. A âncora entra no
   documento antes do clique, porque o Safari ignora clique em elemento que não está nele, e sai depois. */
function downloadPdf(contract: Contract) {
  const link = document.createElement("a");
  link.href = `/api/contratos/${contract.id}/pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// A prancha de contratos: a barra de busca, filtros e o jeito de ver em cima, o funil por situação ou a
// tabela no meio e a paginação no pé, na receita da de orçamentos (2026-10-26, a pedido: "a visualização em
// etapas para ficar mais organizado e o modo tabela", no lugar da grade de cartões). O filtro vive na URL e
// quem faz o trabalho é o servidor; aqui ficam a espera do campo de busca, o filtro adiantado, o jeito de ver
// e o que está aberto sobre a lista, que tem endereço: a ficha (`/contratos/<id>`), o editor do rascunho
// (`/contratos/<id>/editar`, numa janela grande desde o mesmo dia) e a de criar (`/contratos/novo`). No
// celular vale sempre o funil, porque tabela é coisa de desktop. Trocar qualquer filtro volta à primeira página.
export function ContractsBoard({ page, query, view: saved, lookups, aiAvailable, viewing: routeViewing, editing: routeEditing, creating: routeCreating = false, prefill }: ContractsBoardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [search, setSearch] = useState(query.search);
  // O filtro em vigor na tela, adiantado: a escolha marca na hora e a URL vai atrás. Quando a resposta
  // chega, o que veio da URL passa a valer, ajustado durante o render, como o React pede para prop nova.
  const [live, setLive] = useState(query);
  const [seen, setSeen] = useState(query);
  if (seen !== query) {
    setSeen(query);
    setLive(query);
  }
  const typing = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(typing.current), []);

  // O jeito de ver vive em cookie, então o servidor já manda a página certa; o estado aqui é só para a troca
  // valer no clique. No celular vale sempre o funil.
  const [view, setView] = useState<ContractsView>(saved);
  const asTable = view === "tabela" && !mobile;

  // O que está aberto tem endereço, no contrato das janelas da casa: nasce do que a URL pediu e daí em diante
  // troca só a URL, sem sair da tela, por `pushState`; o voltar do navegador fecha, ou reabre, pelo
  // `popstate`. Uma atualização de dados não mexe nessa escolha local: só uma mudança real nas props da rota.
  const routeTarget = routeOf(routeViewing, routeEditing, routeCreating);
  const routeKey = routeTarget === null ? "" : routeTarget.kind === "new" ? "novo" : `${routeTarget.kind}:${routeTarget.contract.id}`;
  const [target, setTarget] = useState<Target>(routeTarget);
  const [seenRoute, setSeenRoute] = useState(routeKey);
  if (seenRoute !== routeKey) {
    setSeenRoute(routeKey);
    setTarget(routeTarget);
  }
  const viewing = target?.kind === "view" ? target.contract : null;
  const editing = target?.kind === "edit" ? target.contract : null;
  const creating = target?.kind === "new";
  /* As janelas pesadas nascem só na primeira abertura, e seguem montadas depois, para a saída animar. */
  const viewReady = useOpenedOnce(viewing !== null);
  const createReady = useOpenedOnce(creating);
  const closeEditorRef = useRef<(() => void) | null>(null);

  const show = useCallback((next: Target) => {
    setTarget(next);
    window.history.pushState(null, "", `${pathOf(next)}${window.location.search}`);
  }, []);

  const items = page.items;
  useEffect(() => {
    const onPopState = () => {
      const [, , segment, action] = window.location.pathname.split("/");
      if (!segment) return setTarget(null);
      if (segment === "novo") return setTarget({ kind: "new" });
      const contract = items.find((entry) => entry.id === segment) ?? [routeViewing, routeEditing].find((entry) => entry?.id === segment);
      // O contrato que não está na página da lista vem do servidor, pela página dele.
      if (!contract) return router.refresh();
      setTarget(action === "editar" && contract.status === "draft" ? { kind: "edit", contract } : { kind: "view", contract });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [items, routeViewing, routeEditing, router]);

  /* O rascunho nasceu: o editor abre na janela grande. A página do editor monta a lista com ele aberto, já com
     o contrato que o servidor acabou de gravar. */
  const created = (id: string) => router.push(`/contratos/${id}/editar` as Route);

  const edit = useCallback((contract: Contract) => show({ kind: "edit", contract }), [show]);

  /* Sair do editor: ele já salvou o que faltava, então a lista é refeita pelo servidor para mostrar o que mudou. */
  const leaveEditor = () => {
    show(null);
    router.refresh();
  };

  /* Criar no editor: a ficha abre no contrato salvo, de onde ele é enviado para assinatura. */
  const createdInEditor = (contract: Contract) => {
    show({ kind: "view", contract });
    router.refresh();
  };

  /* Enviar, reenviar e cancelar: a regra é do servidor, e a lista e a janela são refeitas por ele depois. */
  const send = useCallback(
    async (contract: Contract) => {
      const result = await callAction(sendContractAction({ id: contract.id }));
      if (!result.ok) {
        toast({ title: "Não deu para enviar", description: result.error, tone: "danger" });
        return;
      }
      toast({
        title: result.reminder ? "Convite reenviado" : "Convite enviado",
        description: result.emailed ? "As duas partes receberam o link de assinatura por e-mail." : "O e-mail não saiu neste ambiente. Copie o link de cada parte na ficha do contrato.",
        tone: result.emailed ? "success" : "warning",
      });
      setTarget((current) => (current?.kind === "view" && current.contract.id === contract.id ? { kind: "view", contract: result.contract } : current));
    },
    [toast],
  );

  const cancel = useCallback(
    async (contract: Contract) => {
      const result = await callAction(cancelContractAction({ id: contract.id }));
      if (!result.ok) {
        toast({ title: "Não deu para cancelar", description: result.error, tone: "danger" });
        return;
      }
      setTarget((current) => (current?.kind === "view" && current.contract.id === contract.id ? { kind: "view", contract: result.contract } : current));
      toast({ title: "Contrato cancelado", description: `${contract.reference} não pode mais ser assinado.`, tone: "neutral" });
    },
    [toast],
  );

  /* As ações de cada contrato, as mesmas no cartão do funil e na linha da tabela. */
  const actionsFor = useCallback<ContractActionsFor>(
    (contract) => ({
      onOpen: () => show({ kind: "view", contract }),
      onEdit: () => edit(contract),
      onSend: () => void send(contract),
      onDownload: () => downloadPdf(contract),
      onCancel: () => void cancel(contract),
    }),
    [show, edit, send, cancel],
  );

  /* `go` lê `live` por uma ref, e não pela variável do fechamento, pelo mesmo motivo da prancha de orçamentos:
     a busca com espera dispara depois, e um `live` velho apagaria o filtro escolhido nesse intervalo. */
  const liveRef = useRef(live);
  useEffect(() => {
    liveRef.current = live;
  }, [live]);

  const go = useCallback(
    (next: Partial<ContractsQuery>) => {
      const merged = { ...liveRef.current, ...next };
      setLive(merged);
      const params = new URLSearchParams();
      if (merged.search) params.set(QUERY_PARAM, merged.search);
      if (merged.status !== defaultQuery.status) params.set(STATUS_PARAM, merged.status);
      if (merged.source !== defaultQuery.source) params.set(SOURCE_PARAM, merged.source);
      if (merged.kind !== defaultQuery.kind) params.set(KIND_PARAM, merged.kind);
      if (merged.page > 1) params.set(PAGE_PARAM, String(merged.page));
      /* O tamanho padrão de cada visão fica fora da URL: o servidor já o sabe pelo cookie da visão. */
      if (merged.pageSize !== CONTRACTS_PER_PAGE && merged.pageSize !== FUNNEL_PER_PAGE) params.set(PAGE_SIZE_PARAM, String(merged.pageSize));

      const search = params.toString();
      /* O filtro mantém o endereço em que a pessoa está, senão trocar a página fechava a janela aberta. */
      const base = window.location.pathname.startsWith(LIST_PATH) ? window.location.pathname : LIST_PATH;
      startTransition(() => router.replace((search ? `${base}?${search}` : base) as Route, { scroll: false }));
    },
    [router],
  );

  const changeView = (next: ContractsView) => {
    setView(next);
    saveContractsView(next);
  };

  // Cada visão pede ao servidor a página da medida dela: trinta na tabela e cem no funil. A troca só pede
  // outra página quando o tamanho muda de verdade.
  const currentSize = live.pageSize;
  const currentPage = live.page;
  useEffect(() => {
    const size = asTable ? CONTRACTS_PER_PAGE : FUNNEL_PER_PAGE;
    if (size === currentSize) return;
    const timer = window.setTimeout(() => go({ pageSize: size, page: remapPage(currentPage, currentSize, size) }), RESIZE_PAUSE);
    return () => window.clearTimeout(timer);
  }, [asTable, currentSize, currentPage, go]);

  // Cada tecla refaz a página no servidor, então o campo espera a pessoa parar de digitar.
  const onSearch = (value: string) => {
    setSearch(value);
    window.clearTimeout(typing.current);
    typing.current = window.setTimeout(() => go({ search: value, page: 1 }), TYPING_PAUSE);
  };

  const changePage = useCallback((next: number) => go({ page: next }), [go]);

  const pages = Math.max(1, Math.ceil(page.total / live.pageSize));
  const active = activeContractsFilters(live);
  const filtering = Boolean(live.search) || active.length > 0;
  /* Uma página que ficou para trás do fim (o último item dela saiu) volta para a última que existe. */
  useEffect(() => {
    if (live.page > pages) go({ page: pages });
  }, [live.page, pages, go]);
  const pastEnd = page.total > 0 && page.items.length === 0;
  /* Limpar leva a busca junto dos filtros: no vazio a pessoa quer a lista de volta inteira, e não metade. */
  const clearAll = () => {
    setSearch("");
    go({ ...clearedFilters, search: "", page: 1 });
  };

  // No celular a paginação mora na barra flutuante do menu, passando de uma página.
  useFloatingPagerRegistration(mobile && pages > 1 ? { page: live.page, pageCount: pages, onPageChange: changePage, label: "Páginas de contratos" } : null);

  /* O menu de filtros, no desenho do da base de clientes e dos projetos: situação em escolha única com a
     contagem da base inteira em cada uma, origem e tipo em escolha única. Cada escolha vale na hora e não
     fecha o menu. */
  const filterSections: DropdownSection[] = [
    {
      id: "status",
      label: "Situação",
      items: statusFilterValues.map((value) => ({
        id: `status-${value}`,
        label: statusFilterLabels[value],
        icon: value === "todos" ? undefined : contractStatuses[value].icon,
        count: value === "todos" ? undefined : page.counts[value],
        selected: live.status === value,
        keepOpen: true,
        onSelect: () => go({ status: value, page: 1 }),
      })),
    },
    {
      id: "source",
      label: "Origem",
      items: sourceFilterValues.map((value) => ({
        id: `source-${value}`,
        label: sourceFilterLabels[value],
        icon: value === "todas" ? undefined : contractSources[value].icon,
        selected: live.source === value,
        keepOpen: true,
        onSelect: () => go({ source: value, page: 1 }),
      })),
    },
    {
      id: "kind",
      label: "Tipo",
      items: kindFilterValues.map((value) => ({
        id: `kind-${value}`,
        label: kindFilterLabels[value],
        selected: live.kind === value,
        keepOpen: true,
        onSelect: () => go({ kind: value, page: 1 }),
      })),
    },
    ...(active.length > 0
      ? [{ id: "reset", items: [{ id: "reset", label: "Limpar filtros", icon: ArrowCounterClockwiseIcon, onSelect: () => go(clearedFilters) }] }]
      : []),
  ];

  const range = useMemo(() => ({ page: live.page, pageSize: live.pageSize, total: page.total }), [live.page, live.pageSize, page.total]);

  const pagination = useMemo(
    () => (pages > 1 && !mobile ? <Pagination page={live.page} pageSize={live.pageSize} total={page.total} onPageChange={changePage} label="Páginas de contratos" /> : undefined),
    [pages, mobile, live.page, live.pageSize, page.total, changePage],
  );

  return (
    <div className={styles.board}>
      <PageToolbar
        search={{
          value: search,
          onChange: onSearch,
          placeholder: "Buscar contratos",
          label: "Buscar contrato por título, número, cliente ou projeto",
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
          onChange: (next) => changeView(next === "tabela" ? "tabela" : "funil"),
          label: "Jeito de ver a lista",
        }}
        action={
          /* Texto no desktop e só o ícone no celular, por CSS e não por media query em JS, para a marcação
             não saltar na hidratação: os dois existem e cada largura mostra um. */
          <>
            <span className={styles.wide}>
              <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => show({ kind: "new" })}>
                Novo contrato
              </Button>
            </span>
            <span className={styles.narrow}>
              <IconButton label="Novo contrato" size="sm" radius="md" onClick={() => show({ kind: "new" })}>
                <PlusIcon />
              </IconButton>
            </span>
          </>
        }
      />

      {asTable ? (
        <ContractsTable contracts={page.items} actionsFor={actionsFor} range={range} footer={pagination} />
      ) : page.items.length === 0 ? (
        <EmptyState
          icon={SignatureIcon}
          title={pastEnd ? "Essa página não existe mais" : filtering ? "Nenhum contrato encontrado" : "Nenhum contrato ainda"}
          description={
            pastEnd
              ? "Algo saiu da lista e a página ficou para trás. Levando você para a última."
              : filtering
                ? "Nada bateu com o que você procurou. Tente outro título, número, cliente ou projeto, ou limpe a busca."
                : "Crie o primeiro contrato a partir de um orçamento aprovado, de um modelo da casa ou do zero."
          }
        >
          {!pastEnd && filtering && (
            <Button variant="secondary" size="sm" radius="md" iconStart={<ArrowCounterClockwiseIcon />} onClick={clearAll}>
              Limpar busca
            </Button>
          )}
          {!pastEnd && (
            <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => show({ kind: "new" })}>
              Novo contrato
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className={styles.funnel}>
          <ContractsFunnel contracts={page.items} actionsFor={actionsFor} />
        </div>
      )}

      {/* O pé do funil só existe quando há mais de uma página, e só com a barra de páginas (2026-10-29, a pedido:
          "tire esse footer, para aproveitar 100% a tela"): a contagem saiu, e com uma página só o funil vai até o
          pé da tela. Na tabela as páginas moram no pé da própria tabela. A página que ficou para trás do fim
          (`pastEnd`) mantém a barra, para a pessoa não ficar presa numa tela sem paginação. */}
      {!asTable && (pages > 1 || pastEnd) && <div className={styles.foot}>{pagination}</div>}

      {viewReady && (
        <ContractDialog
          contract={viewing}
          onClose={() => show(null)}
          onEdit={() => viewing && edit(viewing)}
          onSend={() => viewing && void send(viewing)}
          onDownload={() => viewing && downloadPdf(viewing)}
          onCancel={() => viewing && void cancel(viewing)}
        />
      )}

      {/* O editor do rascunho na janela grande (2026-10-26, a pedido: "abrir em modal grande também"), a mesma do
          editor de orçamento. O Escape e o toque fora passam pelo sair do editor, que salva o que faltava antes
          de fechar. */}
      <Dialog
        open={editing !== null}
        onClose={() => (closeEditorRef.current ? closeEditorRef.current() : show(null))}
        label={editing ? `Editar ${editing.reference}` : "Editar contrato"}
        size="xl"
        surface="solid"
        focusOnOpen={false}
      >
        {editing && (
          <ContractEditor
            key={editing.id}
            contract={editing}
            lookups={lookups}
            aiAvailable={aiAvailable}
            closeRef={closeEditorRef}
            onLeave={leaveEditor}
            onCreated={createdInEditor}
          />
        )}
      </Dialog>

      {createReady && <NewContractDialog open={creating} clientId={prefill?.clientId} onClose={() => show(null)} onCreated={created} />}
    </div>
  );
}
