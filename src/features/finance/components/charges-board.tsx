"use client";

import { ArrowCounterClockwiseIcon, CurrencyCircleDollarIcon, ListBulletsIcon, PlusIcon, SquaresFourIcon, XCircleIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useFloatingActionsRegistration, useFloatingPagerRegistration } from "@/components/layout/floating-actions";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
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
import { chargeMethods, chargeStatuses, payerOf } from "../labels";
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
import { nextInstallment, type Charge, type ChargeMethod, type Installment } from "../summary";
import { saveChargesGridSize, saveChargesView, type ChargesView } from "../view-cookie";
import { ChargeCard } from "./charge-card";
import { ChargeDialog } from "./charge-dialog";
import type { ChargeMenuActions } from "./charge-menu";
import { ChargesTable } from "./charges-table";
import { NewChargeDialog } from "./new-charge-dialog";
import styles from "./charges-board.module.css";

export type ChargesBoardProps = {
  page: ChargesListPage;
  query: ChargesQuery;
  view: ChargesView;
  lookups: ChargeLookups;
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

const pathOf = (viewing: Charge | null, creating: boolean) => (creating ? "/cobrancas/nova" : viewing ? `/cobrancas/${viewing.id}` : "/cobrancas");

// A prancha de cobranças (2026-09-15): a barra de busca e filtros em cima, a tabela ou a grade no meio e a
// paginação embaixo, na estrutura das outras listas da casa, com a visão em cookie. O filtro vive na URL e
// quem faz o trabalho é o servidor. A ficha (`/cobrancas/<id>`) e a gaveta de criar (`/cobrancas/nova`) têm
// endereço, por `pushState`. As ações (enviar, confirmar parcela, reabrir, cancelar) são do servidor, que
// devolve a cobrança já mudada para a ficha e refaz a lista.
export function ChargesBoard({ page, query, view: saved, lookups, viewing: initialViewing, creating: initialCreating = false, prefill }: ChargesBoardProps) {
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
    window.history.pushState(null, "", `${pathOf(nextViewing, nextCreating)}${window.location.search}`);
  };

  const created = (charge: Charge) => {
    show(charge, false);
  };

  const copyLink = async (charge: Charge) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/cobranca/${charge.token}`);
      toast({ title: "Link copiado", description: `O link de ${payerOf(charge).name} está na área de transferência.`, tone: "success" });
    } catch {
      toast({ title: "Não deu para copiar", description: "Abra a ficha e copie o endereço pela barra do navegador.", tone: "warning" });
    }
  };

  const send = async (charge: Charge) => {
    const result = await callAction(sendChargeAction({ id: charge.id }));
    if (!result.ok) {
      toast({ title: "Não deu para enviar", description: result.error, tone: "danger" });
      return;
    }
    if (viewing?.id === charge.id) setViewing(result.charge);
    toast({
      title: result.reminder ? "Lembrete enviado" : "Cobrança enviada",
      description: result.emailed ? `${payerOf(charge).name} recebeu o e-mail com o link.` : "O e-mail não saiu neste ambiente. Copie o link do cliente na ficha.",
      tone: result.emailed ? "success" : "warning",
    });
  };

  const [busyInstallment, setBusyInstallment] = useState<string | null>(null);
  const pay = async (charge: Charge, installment: Installment) => {
    setBusyInstallment(installment.id);
    const result = await callAction(payInstallmentAction({ id: charge.id, installmentId: installment.id, method: null, paidOn: null }));
    setBusyInstallment(null);
    if (!result.ok) {
      toast({ title: "Não deu para confirmar", description: result.error, tone: "danger" });
      return;
    }
    if (viewing?.id === charge.id) setViewing(result.charge);
    toast({ title: "Pagamento confirmado", description: `${formatMoney(installment.amount)} entrou no caixa como recebimento de ${payerOf(charge).company ?? payerOf(charge).name}.`, tone: "success" });
  };

  const reopen = async (charge: Charge, installment: Installment) => {
    setBusyInstallment(installment.id);
    const result = await callAction(reopenInstallmentAction({ id: charge.id, installmentId: installment.id }));
    setBusyInstallment(null);
    if (!result.ok) {
      toast({ title: "Não deu para reabrir", description: result.error, tone: "danger" });
      return;
    }
    if (viewing?.id === charge.id) setViewing(result.charge);
    toast({ title: "Parcela reaberta", description: "A entrada saiu das movimentações.", tone: "neutral" });
  };

  const [cancelling, setCancelling] = useState<Charge | null>(null);
  const [removing, setRemoving] = useState(false);
  /* Encerrar a série: a cobrança fica, a próxima não nasce. Sem confirmação, porque nada se perde e a
     recorrência pode ser religada na próxima cobrança. */
  const stopRecurrence = async (charge: Charge) => {
    const result = await callAction(stopRecurrenceAction({ id: charge.id }));
    if (!result.ok) {
      toast({ title: "Não deu para encerrar", description: result.error, tone: "danger" });
      return;
    }
    toast({ title: "Recorrência encerrada", description: `${charge.reference} continua em aberto; a próxima não nasce mais.`, tone: "success" });
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
    setCancelling(null);
    toast({ title: "Cobrança cancelada", description: `${cancelling.reference} não pode mais ser paga pelo link.`, tone: "neutral" });
  };

  const actionsOf = (charge: Charge): ChargeMenuActions => {
    const next = nextInstallment(charge);
    return {
      onSend: () => void send(charge),
      onCopyLink: () => void copyLink(charge),
      onPayNext: next ? () => void pay(charge, next) : undefined,
      onStopRecurrence: charge.recurrence !== "none" ? () => void stopRecurrence(charge) : undefined,
      onCancel: () => setCancelling(charge),
    };
  };

  const go = useCallback(
    (next: Partial<ChargesQuery>) => {
      const merged = { ...live, ...next };
      setLive(merged);
      const params = new URLSearchParams();
      if (merged.search) params.set(QUERY_PARAM, merged.search);
      if (merged.status !== defaultQuery.status) params.set(STATUS_PARAM, merged.status);
      if (merged.method !== defaultQuery.method) params.set(METHOD_PARAM, merged.method);
      if (merged.page > 1) params.set(PAGE_PARAM, String(merged.page));
      if (merged.pageSize !== (asTable ? TABLE_PER_PAGE : GRID_PER_PAGE_DEFAULT)) params.set(PAGE_SIZE_PARAM, String(merged.pageSize));
      const search = params.toString();
      const base = pathOf(viewing, creating);
      startTransition(() => router.replace((search ? `${base}?${search}` : base) as Route, { scroll: false }));
    },
    [live, viewing, creating, router, asTable],
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

  useFloatingPagerRegistration(mobile && pages > 1 && !viewing && !creating ? { page: live.page, pageCount: pages, onPageChange: changePage, label: "Páginas de cobranças" } : null);

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

  const pagination = pages > 1 && !mobile ? <Pagination page={live.page} pageSize={live.pageSize} total={page.total} onPageChange={changePage} label="Páginas de cobranças" /> : undefined;

  return (
    <div className={styles.board}>
      <PageToolbar
        search={{ value: search, onChange: onSearch, placeholder: "Buscar cobranças", label: "Buscar cobrança por título, número ou cliente" }}
        filters={filterSections}
        activeFilters={active.map((filter) => ({ id: filter.id, label: filter.label, icon: filter.icon, onClear: () => go({ ...filter.clear, page: 1 }) }))}
        view={{ value: view, options: viewOptions, onChange: (next) => changeView(next === "grade" ? "grade" : "tabela"), label: "Jeito de ver a lista" }}
        action={
          <>
            <span className={styles.wide}>
              <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => show(viewing, true)}>
                Nova cobrança
              </Button>
            </span>
            <span className={styles.narrow}>
              <IconButton label="Nova cobrança" size="sm" radius="md" onClick={() => show(viewing, true)}>
                <PlusIcon />
              </IconButton>
            </span>
          </>
        }
      />

      <div className={styles.totals} aria-label="Resumo das cobranças">
        <span className={styles.total}>
          <Text as="span" variant="caption1" tone="secondary">
            A receber
          </Text>
          <Text as="span" variant="footnote" weight="semibold" numeric>
            {formatMoney(page.totals.receivable)}
          </Text>
        </span>
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
            Cobranças
          </Text>
          <Text as="span" variant="footnote" weight="semibold" numeric>
            {numberFormat.format(page.counts.open + page.counts.partial + page.counts.overdue)} em aberto, {numberFormat.format(page.counts.paid)} pagas
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
                title={filtering ? "Nenhuma cobrança encontrada" : "Nenhuma cobrança ainda"}
                description={
                  filtering
                    ? "Nada bateu com o que você procurou. Tente outro número, cliente ou valor, ou limpe a busca."
                    : "Crie a primeira cobrança a partir de um orçamento aprovado e acompanhe o recebimento por aqui."
                }
              >
                {filtering && (
                  <Button variant="secondary" size="sm" radius="md" iconStart={<ArrowCounterClockwiseIcon />} onClick={clearAll}>
                    Limpar busca
                  </Button>
                )}
                <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => show(viewing, true)}>
                  Nova cobrança
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
              {page.total === 0 ? "Sem cobranças" : `Mostrando ${numberFormat.format(from)} a ${numberFormat.format(to)} de ${numberFormat.format(page.total)}`}
            </Text>
            {pagination}
          </footer>
        </>
      )}

      <ChargeDialog charge={viewing} onClose={() => show(null, false)} onSend={viewing ? () => void send(viewing) : undefined} onCopyLink={viewing ? () => void copyLink(viewing) : undefined} onCancel={viewing ? () => setCancelling(viewing) : undefined} onPay={viewing ? (installment) => void pay(viewing, installment) : undefined} onReopen={viewing ? (installment) => void reopen(viewing, installment) : undefined} busyInstallment={busyInstallment} />

      <NewChargeDialog open={creating} lookups={lookups} clientId={prefill?.clientId} onClose={() => show(viewing, false)} onCreated={created} />

      <Dialog open={cancelling !== null} onClose={() => !removing && setCancelling(null)} label="Cancelar cobrança" size="sm" focusOnOpen={false}>
        {cancelling && <ConfirmCancel charge={cancelling} busy={removing} onCancel={() => setCancelling(null)} onConfirm={() => void cancel()} />}
      </Dialog>
    </div>
  );
}

function ConfirmCancel({ charge, busy, onCancel, onConfirm }: { charge: Charge; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  useFloatingActionsRegistration({ primary: { label: busy ? "Cancelando" : "Cancelar cobrança", icon: <XCircleIcon weight="bold" />, loading: busy, onClick: onConfirm }, cancel: { label: "Voltar", onClick: onCancel } });
  return (
    <div className={styles.confirm}>
      <Text as="h2" variant="headline" weight="semibold">
        Cancelar {charge.reference}?
      </Text>
      <Text variant="footnote" tone="secondary">
        As parcelas em aberto deixam de valer e o link do cliente passa a mostrar a cobrança como cancelada. O que já foi pago continua no caixa.
      </Text>
      <div className={styles.confirmActions}>
        <Button variant="outline" size="sm" radius="md" disabled={busy} onClick={onCancel}>
          Voltar
        </Button>
        <Button variant="danger" size="sm" radius="md" iconStart={<XCircleIcon />} loading={busy} onClick={onConfirm}>
          {busy ? "Cancelando" : "Cancelar cobrança"}
        </Button>
      </div>
    </div>
  );
}
