"use client";

import { ArrowCounterClockwiseIcon, PlusIcon, SignatureIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useFloatingPagerRegistration } from "@/components/layout/floating-actions";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Pagination } from "@/components/ui/pagination";
import { Text } from "@/components/ui/text";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { callAction } from "@/lib/action";
import { SCROLL_CONTAINER } from "@/lib/scroll";
import { cancelContractAction, sendContractAction } from "../actions";
import { saveContractsGridSize } from "../grid-cookie";
import { contractSources, contractStatuses } from "../labels";
import {
  GRID_PER_PAGE_DEFAULT,
  KIND_PARAM,
  MOBILE_PER_PAGE,
  PAGE_PARAM,
  PAGE_SIZE_PARAM,
  QUERY_PARAM,
  SOURCE_PARAM,
  STATUS_PARAM,
  activeContractsFilters,
  clearedFilters,
  defaultQuery,
  gridPageSize,
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
import type { Contract } from "../summary";
import { ContractCard } from "./contract-card";
import { useOpenedOnce } from "@/hooks/use-opened-once";
import styles from "./contracts-board.module.css";

/* A ficha do contrato e o novo contrato entram por importação dinâmica, montados só na primeira abertura
   (varredura de peso de 2026-09-21): a listagem não precisa do visualizador de documento para desenhar a
   lista. */
const ContractDialog = dynamic(() => import("./contract-dialog").then((module) => module.ContractDialog));
const NewContractDialog = dynamic(() => import("./new-contract-dialog").then((module) => module.NewContractDialog));

export type ContractsBoardProps = {
  page: ContractsListPage;
  query: ContractsQuery;
  /** O contrato que a URL pede aberto na janela (`/contratos/<id>`); nada para só listar. */
  viewing?: Contract | null;
  /** A janela de criar já aberta, quando a URL é `/contratos/novo`. */
  creating?: boolean;
  /** O que a URL manda preencher na janela de criar: hoje o cliente, vindo do leque da ficha dele. */
  prefill?: { clientId?: string };
};

/** Quanto o campo espera parar de digitar antes de refazer a busca no servidor. */
const TYPING_PAUSE = 320;

/** Quanto a grade espera a janela parar de mudar de largura antes de pedir outro tamanho de página. */
const RESIZE_PAUSE = 200;

const numberFormat = new Intl.NumberFormat("pt-BR");

/** O endereço da tela conforme o que está aberto: a janela de criar, a do contrato, ou a lista nua. */
const pathOf = (viewing: Contract | null, creating: boolean) => (creating ? "/contratos/novo" : viewing ? `/contratos/${viewing.id}` : "/contratos");

/* Um clique e o arquivo desce: a rota devolve o PDF pronto com `Content-Disposition`. A âncora entra no
   documento antes do clique, porque o Safari ignora clique em elemento que não está nele, e sai depois. */
function downloadPdf(contract: Contract) {
  const link = document.createElement("a");
  link.href = `/api/contratos/${contract.id}/pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// A prancha de contratos (2026-09-14, a pedido, sobre uma referência de grade de cartões do usuário): a barra
// de busca e filtros em cima, a grade de cartões no meio e a paginação embaixo, na mesma estrutura da base de
// clientes, do catálogo e dos projetos. O filtro vive na URL e quem faz o trabalho é o servidor, então a
// página é compartilhável e volta igual pelo histórico; aqui ficam a espera do campo de busca, o filtro
// adiantado, a janela do contrato e a de criar. Trocar qualquer filtro leva de volta para a primeira página.
export function ContractsBoard({ page, query, viewing: initialViewing, creating: initialCreating = false, prefill }: ContractsBoardProps) {
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

  // A janela do contrato e a de criar têm endereço, no contrato das janelas da casa: nascem do que a URL
  // pediu (`/contratos/<id>`, `/contratos/novo`) e daí em diante trocam só a URL, sem sair da tela, por
  // `pushState`; o voltar do navegador fecha, ou reabre, pelo `popstate`. Uma atualização de dados não mexe
  // nessa escolha local: só uma mudança real nas props da rota pode trocar a janela aberta.
  const [viewing, setViewing] = useState<Contract | null>(initialViewing ?? null);
  const [creating, setCreating] = useState(initialCreating);
  const initialRoute = `${initialCreating}:${initialViewing?.id ?? ""}`;
  const [seenRoute, setSeenRoute] = useState(initialRoute);
  /* As janelas pesadas nascem só na primeira abertura, e seguem montadas depois, para a saída animar. */
  const viewReady = useOpenedOnce(viewing !== null);
  const createReady = useOpenedOnce(creating);
  if (seenRoute !== initialRoute) {
    setSeenRoute(initialRoute);
    setViewing(initialViewing ?? null);
    setCreating(initialCreating);
  }

  useEffect(() => {
    const onPopState = () => {
      const [, , segment] = window.location.pathname.split("/");
      setCreating(segment === "novo");
      setViewing(segment && segment !== "novo" ? (page.items.find((contract) => contract.id === segment) ?? null) : null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [page.items]);

  const show = (nextViewing: Contract | null, nextCreating: boolean) => {
    setViewing(nextViewing);
    setCreating(nextCreating);
    window.history.pushState(null, "", `${pathOf(nextViewing, nextCreating)}${window.location.search}`);
  };

  /* O rascunho nasceu: o editor dele é uma tela, então é navegação de verdade. */
  const created = (id: string) => {
    setCreating(false);
    router.push(`/contratos/${id}/editar` as Route);
  };

  const edit = (contract: Contract) => router.push(`/contratos/${contract.id}/editar` as Route);

  /* Enviar, reenviar e cancelar: a regra é do servidor, e a lista e a janela são refeitas por ele depois. */
  const send = async (contract: Contract) => {
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
    if (viewing?.id === contract.id) setViewing(result.contract);
  };

  const cancel = async (contract: Contract) => {
    const result = await callAction(cancelContractAction({ id: contract.id }));
    if (!result.ok) {
      toast({ title: "Não deu para cancelar", description: result.error, tone: "danger" });
      return;
    }
    if (viewing?.id === contract.id) setViewing(result.contract);
    toast({ title: "Contrato cancelado", description: `${contract.reference} não pode mais ser assinado.`, tone: "neutral" });
  };

  const go = useCallback(
    (next: Partial<ContractsQuery>) => {
      const merged = { ...live, ...next };
      setLive(merged);
      const params = new URLSearchParams();
      if (merged.search) params.set(QUERY_PARAM, merged.search);
      if (merged.status !== defaultQuery.status) params.set(STATUS_PARAM, merged.status);
      if (merged.source !== defaultQuery.source) params.set(SOURCE_PARAM, merged.source);
      if (merged.kind !== defaultQuery.kind) params.set(KIND_PARAM, merged.kind);
      if (merged.page > 1) params.set(PAGE_PARAM, String(merged.page));
      if (merged.pageSize !== GRID_PER_PAGE_DEFAULT) params.set(PAGE_SIZE_PARAM, String(merged.pageSize));

      const search = params.toString();
      const base = pathOf(viewing, creating);
      startTransition(() => router.replace((search ? `${base}?${search}` : base) as Route, { scroll: false }));
    },
    [live, viewing, creating, router],
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
    const area = scrollArea.current;
    const column = (area && area.scrollHeight > area.clientHeight ? area : null) ?? document.querySelector<HTMLElement>(`[${SCROLL_CONTAINER}]`) ?? document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    column.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  // A grade mede quantas colunas formou e pede ao servidor a página que cabe em três linhas, sempre par, na
  // receita do catálogo. A medida entra no cookie para a próxima visita já vir do tamanho certo, e só pede
  // outra página quando o tamanho muda de verdade, depois de a janela parar de mudar.
  const gridRef = useRef<HTMLUListElement>(null);
  const showing = page.items.length;
  const currentSize = live.pageSize;
  const currentPage = live.page;
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    let timer: number | undefined;
    const observer = new ResizeObserver(() => {
      // No celular a página é sempre doze, e não o que a grade mede: numa ou duas colunas a medida daria
      // três ou seis, e a pessoa passaria página o tempo todo.
      const columns = getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length;
      const size = mobile ? MOBILE_PER_PAGE : gridPageSize(columns);
      // O cookie guarda só a medida do desktop: o doze fixo do celular gravado ali faria o desktop abrir
      // curto antes de medir.
      if (!mobile) saveContractsGridSize(size);
      window.clearTimeout(timer);
      if (size === currentSize) return;
      timer = window.setTimeout(() => go({ pageSize: size, page: remapPage(currentPage, currentSize, size) }), RESIZE_PAUSE);
    });
    observer.observe(grid);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [mobile, showing, currentSize, currentPage, go]);

  const pages = Math.max(1, Math.ceil(page.total / live.pageSize));
  const from = (live.page - 1) * live.pageSize + 1;
  const to = Math.min(live.page * live.pageSize, page.total);
  const active = activeContractsFilters(live);
  const filtering = Boolean(live.search) || active.length > 0;
  /* Limpar leva a busca junto dos filtros: no vazio a pessoa quer a lista de volta inteira, e não metade. */
  const clearAll = () => {
    setSearch("");
    go({ ...clearedFilters, search: "", page: 1 });
  };

  // No celular a paginação mora na barra flutuante do menu, no mesmo lugar de salvar e sair de uma janela,
  // em vez de uma segunda barra no pé da lista. Passando de uma página; com uma só, a barra volta a ser
  // busca e sino.
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
        action={
          /* Texto no desktop e só o ícone no celular, por CSS e não por media query em JS, para a marcação
             não saltar na hidratação: os dois existem e cada largura mostra um. */
          <>
            <span className={styles.wide}>
              <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => show(viewing, true)}>
                Novo contrato
              </Button>
            </span>
            <span className={styles.narrow}>
              <IconButton label="Novo contrato" size="sm" radius="md" onClick={() => show(viewing, true)}>
                <PlusIcon />
              </IconButton>
            </span>
          </>
        }
      />

      {page.items.length === 0 ? (
        <EmptyState
          icon={SignatureIcon}
          title={filtering ? "Nenhum contrato encontrado" : "Nenhum contrato ainda"}
          description={
            filtering
              ? "Nada bateu com o que você procurou. Tente outro título, número, cliente ou projeto, ou limpe a busca."
              : "Crie o primeiro contrato a partir de um orçamento aprovado, de um modelo da casa ou do zero."
          }
        >
          {filtering && (
            <Button variant="secondary" size="sm" radius="md" iconStart={<ArrowCounterClockwiseIcon />} onClick={clearAll}>
              Limpar busca
            </Button>
          )}
          <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => show(viewing, true)}>
            Novo contrato
          </Button>
        </EmptyState>
      ) : (
        <div ref={scrollArea} className={styles.scrollArea}>
          <ul ref={gridRef} className={styles.grid}>
            {page.items.map((contract) => (
              <ContractCard
                key={contract.id}
                contract={contract}
                onOpen={() => show(contract, false)}
                onEdit={() => edit(contract)}
                onSend={() => void send(contract)}
                onDownload={() => downloadPdf(contract)}
                onCancel={() => void cancel(contract)}
              />
            ))}
          </ul>
        </div>
      )}

      {/* O pé da grade, preso embaixo e à direita no desktop, como no catálogo e nos projetos: a contagem e,
          passando de uma página, a barra. No celular a barra mora na barra flutuante do menu. */}
      {page.items.length > 0 && (
        <div className={styles.foot}>
          <Text as="span" variant="footnote" tone="secondary">
            Mostrando {numberFormat.format(from)} a {numberFormat.format(to)} de {numberFormat.format(page.total)}
          </Text>
          {pages > 1 && !mobile && <Pagination page={live.page} pageSize={live.pageSize} total={page.total} onPageChange={changePage} label="Páginas de contratos" />}
        </div>
      )}

      {viewReady && (
        <ContractDialog
          contract={viewing}
          onClose={() => show(null, false)}
          onEdit={() => viewing && edit(viewing)}
          onSend={() => viewing && void send(viewing)}
          onDownload={() => viewing && downloadPdf(viewing)}
          onCancel={() => viewing && void cancel(viewing)}
        />
      )}
      {createReady && (
        <NewContractDialog open={creating} clientId={prefill?.clientId} onClose={() => show(viewing, false)} onCreated={created} />
      )}
    </div>
  );
}
