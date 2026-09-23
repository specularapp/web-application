"use client";

import { ArrowCounterClockwiseIcon, CurrencyCircleDollarIcon, ListBulletsIcon, PlusIcon, SquaresFourIcon, XCircleIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useFloatingActionsRegistration, useFloatingPagerRegistration } from "@/components/layout/floating-actions";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog } from "@/components/ui/dialog";
import type { DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Pagination } from "@/components/ui/pagination";
import { Text } from "@/components/ui/text";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { callAction } from "@/lib/action";
import { SCROLL_CONTAINER } from "@/lib/scroll";
import { formatMoney } from "@/lib/utils/format";
import { cancelChargeAction, payInstallmentAction, reopenInstallmentAction, sendChargeAction, stopRecurrenceAction } from "../actions";
import { chargeDirections, chargeMethods, chargeStatuses, partyOf } from "../labels";
import {
  GRID_PER_PAGE_DEFAULT,
  METHOD_PARAM,
  MOBILE_PER_PAGE,
  PAGE_PARAM,
  PAGE_SIZE_PARAM,
  QUERY_PARAM,
  STATUS_PARAM,
  TABLE_PER_PAGE,
  activeChargesFilters,
  clearedFilters,
  defaultQuery,
  gridPageSize,
  methodFilterLabels,
  methodFilterValues,
  remapPage,
  statusFilterLabels,
  statusFilterValues,
  type ChargesListPage,
  type ChargesQuery,
} from "../list-options";
import type { ChargeLookups } from "../service";
import { nextInstallment, type Charge, type ChargeDirection, type ChargeMethod, type Installment } from "../summary";
import { saveChargesGridSize, saveChargesView, type ChargesView } from "../view-cookie";
import { ChargeCard } from "./charge-card";
import type { ChargeMenuActions } from "./charge-menu";
import { ChargesTable } from "./charges-table";
import { useOpenedOnce } from "@/hooks/use-opened-once";
import styles from "./charges-board.module.css";

/* A ficha da cobrança e a nova cobrança entram por importação dinâmica, montadas só na primeira abertura
   (varredura de peso de 2026-09-21): juntas são mais de seiscentas linhas com parcelas, seletor de cliente e
   seletor de data, e a listagem abria carregando as duas sem ninguém ter clicado. */
const ChargeDialog = dynamic(() => import("./charge-dialog").then((module) => module.ChargeDialog));
const NewChargeDialog = dynamic(() => import("./new-charge-dialog").then((module) => module.NewChargeDialog));

export type ChargesBoardProps = {
  page: ChargesListPage;
  query: ChargesQuery;
  view: ChargesView;
  lookups: ChargeLookups;
  direction: ChargeDirection;
  viewing?: Charge | null;
  creating?: boolean;
  /** O que a URL manda preencher na janela de criar: hoje o cliente, vindo do leque da ficha dele. */
  prefill?: { clientId?: string };
};

const TYPING_PAUSE = 320;
const RESIZE_PAUSE = 200;

const numberFormat = new Intl.NumberFormat("pt-BR");

const viewOptions = [
  { value: "tabela", label: "Ver em tabela", icon: <ListBulletsIcon /> },
  { value: "grade", label: "Ver em grade", icon: <SquaresFourIcon /> },
];

const pathOf = (direction: ChargeDirection, viewing: Charge | null, creating: boolean) => {
  const base = direction === "outgoing" ? "/despesas" : "/cobrancas";
  return creating ? `${base}/nova` : viewing ? `${base}/${viewing.id}` : base;
};

// A prancha de cobranças (2026-09-15): a barra de busca e filtros em cima, a tabela ou a grade no meio e a
// paginação embaixo, na estrutura das outras listas da casa, com a visão em cookie. O filtro vive na URL e
// quem faz o trabalho é o servidor. A ficha (`/cobrancas/<id>`) e a gaveta de criar (`/cobrancas/nova`) têm
// endereço, por `pushState`. As ações (enviar, confirmar parcela, reabrir, cancelar) são do servidor, que
// devolve a cobrança já mudada para a ficha e refaz a lista.
export function ChargesBoard({ page, query, view: saved, lookups, direction, viewing: initialViewing, creating: initialCreating = false, prefill }: ChargesBoardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [search, setSearch] = useState(query.search);
  const [live, setLive] = useState(query);
  const [seen, setSeen] = useState(query);
  if (seen !== query) {
    setSeen(query);
    setLive(query);
  }
  const typing = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(typing.current), []);

  const [view, setView] = useState<ChargesView>(saved);
  const asTable = view === "tabela" && !mobile;
  const side = chargeDirections[direction];
  const noun = side.label.toLocaleLowerCase("pt-BR");
  const plural = direction === "outgoing" ? "despesas" : "cobranças";

  const [viewing, setViewing] = useState<Charge | null>(initialViewing ?? null);
  const [creating, setCreating] = useState(initialCreating);
  // A página pode receber dados novos enquanto uma ficha abre. Sincronizar pela identidade da rota, e não
  // pelo objeto da página, impede uma resposta antiga de fechar a janela que a pessoa acabou de abrir.
  const initialRoute = `${initialCreating}:${initialViewing?.id ?? ""}`;
  const [seenRoute, setSeenRoute] = useState(initialRoute);
  if (seenRoute !== initialRoute) {
    setSeenRoute(initialRoute);
    setViewing(initialViewing ?? null);
    setCreating(initialCreating);
  }

  useEffect(() => {
    const onPopState = () => {
      const [, , segment] = window.location.pathname.split("/");
      setCreating(segment === "nova");
      setViewing(segment && segment !== "nova" ? (page.items.find((charge) => charge.id === segment) ?? null) : null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [page.items]);

  const show = (nextViewing: Charge | null, nextCreating: boolean) => {
    setViewing(nextViewing);
    setCreating(nextCreating);
    window.history.pushState(null, "", `${pathOf(direction, nextViewing, nextCreating)}${window.location.search}`);
  };

  const created = (charge: Charge) => {
    show(charge, false);
    startTransition(() => router.refresh());
  };

  const feedbackOf = (charge: Charge, confetti = false) => {
    const party = partyOf(charge);
    return {
      visual: <Avatar name={party.name} src={party.avatarUrl ?? undefined} size="lg" shape="rounded" />,
      confetti,
    };
  };

  const copyLink = async (charge: Charge) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/cobranca/${charge.token}`);
      toast({ title: "Link copiado", description: `O link de ${partyOf(charge).name} está na área de transferência.`, tone: "success", feedback: feedbackOf(charge) });
    } catch {
      toast({ title: "Não deu para copiar", description: "Abra a ficha e copie o endereço pela barra do navegador.", tone: "warning" });
    }
  };

  /* Enviar não é idempotente: cada chamada grava um evento na linha do tempo e dispara um e-mail. Sem trava,
     o segundo clique enquanto o primeiro ainda ia e voltava mandava dois e-mails iguais ao cliente
     (2026-09-22). A referência segura o clique repetido antes do `await`, por cobrança. */
  const sending = useRef<Set<string>>(new Set());
  const send = async (charge: Charge) => {
    if (sending.current.has(charge.id)) return;
    sending.current.add(charge.id);
    try {
      const result = await callAction(sendChargeAction({ id: charge.id }));
      if (!result.ok) {
        toast({ title: "Não deu para enviar", description: result.error, tone: "danger" });
        return;
      }
      if (viewing?.id === charge.id) setViewing(result.charge);
      startTransition(() => router.refresh());
      toast({
        title: result.reminder ? "Lembrete enviado" : "Cobrança enviada",
        description: result.emailed ? `${partyOf(charge).name} recebeu o e-mail com o link.` : "O e-mail não saiu neste ambiente. Copie o link do cliente na ficha.",
        tone: result.emailed ? "success" : "warning",
        feedback: result.emailed ? feedbackOf(charge, true) : undefined,
      });
    } finally {
      sending.current.delete(charge.id);
    }
  };

  const [busyInstallment, setBusyInstallment] = useState<string | null>(null);
  const pay = async (charge: Charge, installment: Installment) => {
    if (busyInstallment) return;
    setBusyInstallment(installment.id);
    const result = await callAction(payInstallmentAction({ id: charge.id, installmentId: installment.id, method: null, paidOn: null }));
    setBusyInstallment(null);
    if (!result.ok) {
      toast({ title: "Não deu para confirmar", description: result.error, tone: "danger" });
      return;
    }
    if (result.warning) toast({ title: "Confira a recorrência", description: result.warning, tone: "warning" });
    if (viewing?.id === charge.id) setViewing(result.charge);
    startTransition(() => router.refresh());
    toast({ title: direction === "outgoing" ? "Pagamento confirmado" : "Recebimento confirmado", description: direction === "outgoing" ? `${formatMoney(installment.amount)} saiu do caixa como pagamento a ${partyOf(charge).company ?? partyOf(charge).name}.` : `${formatMoney(installment.amount)} entrou no caixa como recebimento de ${partyOf(charge).company ?? partyOf(charge).name}.`, tone: "success", feedback: feedbackOf(charge, true) });
  };

  const reopen = async (charge: Charge, installment: Installment) => {
    if (busyInstallment) return;
    setBusyInstallment(installment.id);
    const result = await callAction(reopenInstallmentAction({ id: charge.id, installmentId: installment.id }));
    setBusyInstallment(null);
    if (!result.ok) {
      toast({ title: "Não deu para reabrir", description: result.error, tone: "danger" });
      return;
    }
    if (viewing?.id === charge.id) setViewing(result.charge);
    startTransition(() => router.refresh());
    toast({ title: "Parcela reaberta", description: direction === "outgoing" ? "A saída foi removida das movimentações." : "A entrada saiu das movimentações.", tone: "neutral" });
  };

  const [cancelling, setCancelling] = useState<Charge | null>(null);
  const [removing, setRemoving] = useState(false);
  /* As janelas pesadas nascem só na primeira abertura, e seguem montadas depois, para a saída animar. */
  const viewReady = useOpenedOnce(viewing !== null);
  const createReady = useOpenedOnce(creating);
  /* Encerrar a série: a cobrança fica, a próxima não nasce. Sem confirmação, porque nada se perde e a
     recorrência pode ser religada na próxima cobrança. */
  const stopRecurrence = async (charge: Charge) => {
    const result = await callAction(stopRecurrenceAction({ id: charge.id }));
    if (!result.ok) {
      toast({ title: "Não deu para encerrar", description: result.error, tone: "danger" });
      return;
    }
    toast({ title: "Recorrência encerrada", description: `${charge.reference} continua em aberto; a próxima não nasce mais.`, tone: "success", feedback: feedbackOf(charge) });
    if (viewing?.id === charge.id) setViewing(result.charge);
    startTransition(() => router.refresh());
  };

  const cancel = async () => {
    if (!cancelling) return;
    setRemoving(true);
    const result = await callAction(cancelChargeAction({ id: cancelling.id }));
    setRemoving(false);
    if (!result.ok) {
      toast({ title: "Não deu para cancelar", description: result.error, tone: "danger" });
      return;
    }
    if (viewing?.id === cancelling.id) setViewing(result.charge);
    startTransition(() => router.refresh());
    setCancelling(null);
    toast({ title: `${side.label} cancelada`, description: direction === "outgoing" ? `${cancelling.reference} saiu das contas a pagar.` : `${cancelling.reference} não pode mais ser paga pelo link.`, tone: "neutral" });
  };

  const actionsOf = (charge: Charge): ChargeMenuActions => {
    const next = nextInstallment(charge);
    return {
      onSend: direction === "incoming" ? () => void send(charge) : undefined,
      onCopyLink: direction === "incoming" ? () => void copyLink(charge) : undefined,
      onPayNext: next ? () => void pay(charge, next) : undefined,
      onStopRecurrence: charge.recurrence !== "none" ? () => void stopRecurrence(charge) : undefined,
      onCancel: () => setCancelling(charge),
    };
  };

  /* O que `go` precisa ler fica em referência, e não no fechamento (2026-09-22). O temporizador da busca
     dispara 320 ms depois da tecla: com o filtro preso no fechamento, um `go` antigo reescrevia a URL com a
     situação e o tamanho anteriores, desfazendo a escolha feita nesse meio tempo. De quebra `go` fica
     estável, e o observador da grade deixa de ser desmontado a cada ficha aberta ou fechada. */
  const liveRef = useRef(live);
  const routeRef = useRef({ viewing, creating });
  useEffect(() => {
    liveRef.current = live;
    routeRef.current = { viewing, creating };
  });

  const go = useCallback(
    (next: Partial<ChargesQuery>) => {
      const merged = { ...liveRef.current, ...next };
      liveRef.current = merged;
      setLive(merged);
      const params = new URLSearchParams();
      if (merged.search) params.set(QUERY_PARAM, merged.search);
      if (merged.status !== defaultQuery.status) params.set(STATUS_PARAM, merged.status);
      if (merged.method !== defaultQuery.method) params.set(METHOD_PARAM, merged.method);
      if (merged.page > 1) params.set(PAGE_PARAM, String(merged.page));
      if (merged.pageSize !== (asTable ? TABLE_PER_PAGE : GRID_PER_PAGE_DEFAULT)) params.set(PAGE_SIZE_PARAM, String(merged.pageSize));
      const search = params.toString();
      const base = pathOf(direction, routeRef.current.viewing, routeRef.current.creating);
      startTransition(() => router.replace((search ? `${base}?${search}` : base) as Route, { scroll: false }));
    },
    [router, asTable, direction],
  );

  const changeView = (next: ChargesView) => {
    setView(next);
    saveChargesView(next);
    if (next === "tabela") go({ pageSize: TABLE_PER_PAGE, page: remapPage(live.page, live.pageSize, TABLE_PER_PAGE) });
  };

  const onSearch = (value: string) => {
    setSearch(value);
    window.clearTimeout(typing.current);
    typing.current = window.setTimeout(() => go({ search: value, page: 1 }), TYPING_PAUSE);
  };

  const scrollArea = useRef<HTMLDivElement>(null);
  const changePage = (next: number) => {
    go({ page: next });
    const area = scrollArea.current;
    const column = (area && area.scrollHeight > area.clientHeight ? area : null) ?? document.querySelector<HTMLElement>(`[${SCROLL_CONTAINER}]`) ?? document.documentElement;
    column.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  // A grade mede quantas colunas formou e pede ao servidor a página que cabe em três linhas, na receita das
  // outras grades; a tabela tem trinta por página.
  const gridRef = useRef<HTMLUListElement>(null);
  const showing = page.items.length;
  const currentSize = live.pageSize;
  const currentPage = live.page;
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || asTable) return;
    let timer: number | undefined;
    const observer = new ResizeObserver(() => {
      const columns = getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length;
      const size = mobile ? MOBILE_PER_PAGE : gridPageSize(columns);
      if (!mobile) saveChargesGridSize(size);
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

  const pages = Math.max(1, Math.ceil(page.total / live.pageSize));
  const from = (live.page - 1) * live.pageSize + 1;
  const to = Math.min(live.page * live.pageSize, page.total);
  const active = activeChargesFilters(live);
  const filtering = Boolean(live.search) || active.length > 0;
  const clearAll = () => {
    setSearch("");
    go({ ...clearedFilters, search: "", page: 1 });
  };

  useFloatingPagerRegistration(mobile && pages > 1 && !viewing && !creating ? { page: live.page, pageCount: pages, onPageChange: changePage, label: `Páginas de ${plural}` } : null);

  const filterSections: DropdownSection[] = [
    {
      id: "status",
      label: "Situação",
      items: statusFilterValues.map((value) => ({
        id: `status-${value}`,
        label: statusFilterLabels[value],
        icon: value === "todas" ? undefined : chargeStatuses[value].icon,
        count: value === "todas" ? undefined : page.counts[value],
        selected: live.status === value,
        keepOpen: true,
        onSelect: () => go({ status: value, page: 1 }),
      })),
    },
    {
      id: "method",
      label: "Forma",
      items: methodFilterValues.map((value) => ({
        id: `method-${value}`,
        label: methodFilterLabels[value],
        icon: value === "todas" ? undefined : chargeMethods[value as ChargeMethod].icon,
        selected: live.method === value,
        keepOpen: true,
        onSelect: () => go({ method: value, page: 1 }),
      })),
    },
    ...(active.length > 0 ? [{ id: "reset", items: [{ id: "reset", label: "Limpar filtros", icon: ArrowCounterClockwiseIcon, onSelect: () => go({ ...clearedFilters, page: 1 }) }] }] : []),
  ];

  /* A criação nasce no lado que a lista está mostrando: com "A pagar" à vista, o "+" abre uma despesa, e
     não uma cobrança que a pessoa teria de virar à mão. Em "Tudo" vale a cobrança, que é a maioria. */
  const createLabel = direction === "outgoing" ? "Nova despesa" : "Nova cobrança";

  const pagination = pages > 1 && !mobile ? <Pagination page={live.page} pageSize={live.pageSize} total={page.total} onPageChange={changePage} label={`Páginas de ${plural}`} /> : undefined;

  return (
    <div className={styles.board}>
      <PageToolbar
        search={{ value: search, onChange: onSearch, placeholder: `Buscar ${plural}`, label: `Buscar ${noun} por título, número ou ${direction === "outgoing" ? "fornecedor" : "cliente"}` }}
        filters={filterSections}
        activeFilters={active.map((filter) => ({ id: filter.id, label: filter.label, icon: filter.icon, onClear: () => go({ ...filter.clear, page: 1 }) }))}
        view={{ value: view, options: viewOptions, onChange: (next) => changeView(next === "grade" ? "grade" : "tabela"), label: "Jeito de ver a lista" }}
        action={
          <>
            <span className={styles.wide}>
              <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => show(viewing, true)}>
                {createLabel}
              </Button>
            </span>
            <span className={styles.narrow}>
              <IconButton label={createLabel} size="sm" radius="md" onClick={() => show(viewing, true)}>
                <PlusIcon />
              </IconButton>
            </span>
          </>
        }
      />

      <div className={styles.totals} aria-label={`Resumo de ${plural}`}>
        {/* A receber e a pagar são dois números, e nunca um saldo: somá-los diria que a equipe tem mais
            dinheiro a caminho do que tem, que é o engano que a despesa existe para não deixar acontecer. */}
        {direction === "incoming" && (
          <span className={styles.total}>
            <Text as="span" variant="caption1" tone="secondary">
              A receber
            </Text>
            <Text as="span" variant="footnote" weight="semibold" numeric>
              {formatMoney(page.totals.receivable)}
            </Text>
          </span>
        )}
        {direction === "outgoing" && (
          <span className={styles.total} data-tone={page.totals.payable > 0 ? "danger" : undefined}>
            <Text as="span" variant="caption1" tone="secondary">
              A pagar
            </Text>
            <Text as="span" variant="footnote" weight="semibold" numeric>
              {formatMoney(page.totals.payable)}
            </Text>
          </span>
        )}
        <span className={styles.total} data-tone={page.totals.overdue > 0 ? "danger" : undefined}>
          <Text as="span" variant="caption1" tone="secondary">
            Vencido
          </Text>
          <Text as="span" variant="footnote" weight="semibold" numeric>
            {formatMoney(page.totals.overdue)}
          </Text>
        </span>
        <span className={styles.total}>
          <Text as="span" variant="caption1" tone="secondary">
            Lançamentos
          </Text>
          <Text as="span" variant="footnote" weight="semibold" numeric>
            {numberFormat.format(page.counts.open + page.counts.partial + page.counts.overdue)} em aberto, {numberFormat.format(page.counts.paid)} liquidados
          </Text>
        </span>
      </div>

      {asTable ? (
        <div className={styles.tableArea}>
          <ChargesTable charges={page.items} onOpen={(charge) => show(charge, false)} actionsOf={actionsOf} footer={pagination} range={{ page: live.page, pageSize: live.pageSize, total: page.total }} />
        </div>
      ) : (
        <>
          <div ref={scrollArea} className={styles.scrollArea}>
            {page.items.length === 0 ? (
              <EmptyState
                icon={CurrencyCircleDollarIcon}
                title={filtering ? `Nenhuma ${noun} encontrada` : `Nenhuma ${noun} ainda`}
                description={
                  filtering
                    ? `Nada bateu com o que você procurou. Tente outro número, ${direction === "outgoing" ? "fornecedor" : "cliente"} ou valor, ou limpe a busca.`
                    : direction === "outgoing" ? "Crie a primeira despesa e acompanhe vencimentos e pagamentos por aqui." : "Crie a primeira cobrança a partir de um orçamento aprovado e acompanhe o recebimento por aqui."
                }
              >
                {filtering && (
                  <Button variant="secondary" size="sm" radius="md" iconStart={<ArrowCounterClockwiseIcon />} onClick={clearAll}>
                    Limpar busca
                  </Button>
                )}
                <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => show(viewing, true)}>
                  {createLabel}
                </Button>
              </EmptyState>
            ) : (
              <ul ref={gridRef} className={styles.grid}>
                {page.items.map((charge) => (
                  <li key={charge.id}>
                    <ChargeCard charge={charge} onOpen={() => show(charge, false)} {...actionsOf(charge)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <footer className={styles.foot}>
            <Text as="span" variant="caption1" tone="secondary">
              {page.total === 0 ? `Sem ${plural}` : `Mostrando ${numberFormat.format(from)} a ${numberFormat.format(to)} de ${numberFormat.format(page.total)}`}
            </Text>
            {pagination}
          </footer>
        </>
      )}

      {viewReady && (
        <ChargeDialog charge={viewing} onClose={() => show(null, false)} onSend={viewing ? () => void send(viewing) : undefined} onCopyLink={viewing ? () => void copyLink(viewing) : undefined} onCancel={viewing ? () => setCancelling(viewing) : undefined} onPay={viewing ? (installment) => void pay(viewing, installment) : undefined} onReopen={viewing ? (installment) => void reopen(viewing, installment) : undefined} busyInstallment={busyInstallment} />
      )}

      {createReady && (
        <NewChargeDialog open={creating} lookups={lookups} clientId={prefill?.clientId} direction={direction} onClose={() => show(viewing, false)} onCreated={created} />
      )}

      <Dialog open={cancelling !== null} onClose={() => !removing && setCancelling(null)} label={`Cancelar ${noun}`} size="sm" focusOnOpen={false}>
        {cancelling && <ConfirmCancel charge={cancelling} busy={removing} onCancel={() => setCancelling(null)} onConfirm={() => void cancel()} />}
      </Dialog>
    </div>
  );
}

function ConfirmCancel({ charge, busy, onCancel, onConfirm }: { charge: Charge; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const noun = chargeDirections[charge.direction].label.toLocaleLowerCase("pt-BR");
  useFloatingActionsRegistration({ primary: { label: busy ? "Cancelando" : `Cancelar ${noun}`, icon: <XCircleIcon weight="bold" />, loading: busy, onClick: onConfirm }, cancel: { label: "Voltar", onClick: onCancel } });
  return (
    <div className={styles.confirm}>
      <Text as="h2" variant="headline" weight="semibold">
        Cancelar {charge.reference}?
      </Text>
      <Text variant="footnote" tone="secondary">
        {charge.direction === "outgoing" ? "As parcelas em aberto deixam de valer. O que já foi pago continua registrado no caixa." : "As parcelas em aberto deixam de valer e o link do cliente passa a mostrar a cobrança como cancelada. O que já foi pago continua no caixa."}
      </Text>
      <div className={styles.confirmActions}>
        <Button variant="outline" size="sm" radius="md" disabled={busy} onClick={onCancel}>
          Voltar
        </Button>
        <Button variant="danger" size="sm" radius="md" iconStart={<XCircleIcon />} loading={busy} onClick={onConfirm}>
          {busy ? "Cancelando" : `Cancelar ${noun}`}
        </Button>
      </div>
    </div>
  );
}
