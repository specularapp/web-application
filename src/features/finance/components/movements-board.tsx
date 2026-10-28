"use client";

import {
  ArrowCounterClockwiseIcon,
  ArrowDownLeftIcon,
  ArrowUUpLeftIcon,
  ArrowUpRightIcon,
  BankIcon,
  CalendarBlankIcon,
  EyeIcon,
  HandCoinsIcon,
  PencilSimpleIcon,
  PlusIcon,
  PulseIcon,
  ReceiptIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState, type CSSProperties } from "react";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, DataTableDate, DataTableEmptyValue, DataTableTitle, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Pagination } from "@/components/ui/pagination";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { callAction } from "@/lib/action";
import { formatMoney } from "@/lib/utils/format";
import { deleteTransactionAction, reverseTransactionAction } from "../accounts-actions";
import { chargeMethods } from "../labels";
import type { MovementEntry, MovementsScreenData } from "../movements";
import { AccountMark } from "./account-mark";
import { dayBefore, signedMoney } from "./money";
import { PaymentSheet } from "./payment-sheet";
import { TransactionFormDialog } from "./transaction-form-dialog";
import ticket from "./payment-sheet.module.css";
import styles from "./movements-board.module.css";

type KindFilter = "todas" | "income" | "expense";
type StatusFilter = "confirmadas" | "estornadas" | "todas";
type Period = "30" | "90" | "mes" | "ano" | "tudo";

const PAGE_SIZE = 30;

const periods: Record<Period, string> = { "30": "Últimos 30 dias", "90": "Últimos 90 dias", mes: "Este mês", ano: "Este ano", tudo: "Desde o começo" };

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

/**
 * As movimentações (2026-10-27, fase 4 da vinda do financeiro da Le Ange, no lugar da aba Pagamentos de lá):
 * todo dinheiro que entrou ou saiu da empresa, lançamento avulso ou baixa de parcela, na tabela da casa. Clicar
 * abre o recibo. O leque edita e exclui a avulsa, estorna as duas (a avulsa fica riscada na lista; a baixa reabre
 * a parcela) e abre a cobrança de onde a baixa veio.
 */
export function MovementsBoard({ movements, accounts, categories, today }: MovementsScreenData) {
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("todas");
  const [status, setStatus] = useState<StatusFilter>("confirmadas");
  const [period, setPeriod] = useState<Period>("30");
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<MovementEntry | null>(null);
  const [receipt, setReceipt] = useState<MovementEntry | null>(null);
  const [reversing, setReversing] = useState<MovementEntry | null>(null);
  const [removing, setRemoving] = useState<MovementEntry | null>(null);
  const [pending, setPending] = useState(false);

  const accountOf = (id: string) => accounts.find((account) => account.id === id) ?? null;
  const categoryOf = (id: string | null) => categories.find((category) => category.id === id) ?? null;

  const since = period === "30" ? dayBefore(today, 29) : period === "90" ? dayBefore(today, 89) : period === "mes" ? `${today.slice(0, 7)}-01` : period === "ano" ? `${today.slice(0, 4)}-01-01` : null;
  const inPeriod = useMemo(() => movements.filter((entry) => !since || entry.date >= since), [movements, since]);

  const visible = useMemo(() => {
    const search = normalize(query.trim());
    return inPeriod.filter(
      (entry) =>
        (kind === "todas" || entry.kind === kind) &&
        (status === "todas" || (status === "confirmadas" ? entry.status === "confirmed" : entry.status === "cancelled")) &&
        (!accountFilter || entry.accountId === accountFilter) &&
        (!search || normalize(`${entry.title} ${entry.description} ${entry.reference}`).includes(search)),
    );
  }, [inPeriod, query, kind, status, accountFilter]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const shown = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const run = async (action: Promise<{ ok: true } | { ok: false; error: string }>, done: { title: string; description: string }, failed: string) => {
    setPending(true);
    const result = await callAction(action);
    setPending(false);
    if (!result.ok) {
      toast({ title: failed, description: result.error, tone: "danger" });
      return false;
    }
    toast({ ...done, tone: "success" });
    router.refresh();
    return true;
  };

  const reverse = async () => {
    if (!reversing) return;
    const charge = reversing.origin === "charge";
    const ok = await run(
      reverseTransactionAction({ id: reversing.id }),
      { title: "Movimentação estornada", description: charge ? "A parcela voltou a ficar pendente." : `${formatMoney(reversing.amount)} saiu do caixa.` },
      "Não deu para estornar",
    );
    if (ok) setReversing(null);
  };

  const remove = async () => {
    if (!removing) return;
    const ok = await run(deleteTransactionAction({ id: removing.id }), { title: "Movimentação excluída", description: removing.title }, "Não deu para excluir");
    if (ok) setRemoving(null);
  };

  const used = accounts.filter((account) => movements.some((entry) => entry.accountId === account.id));
  const filterAccount = accountFilter ? accountOf(accountFilter) : null;
  const choose = <T,>(set: (value: T) => void) => (value: T) => (set(value), setPage(1));

  const filterSections: DropdownSection[] = [
    { id: "period", label: "Período", items: (Object.keys(periods) as Period[]).map((value) => ({ id: `period-${value}`, label: periods[value], icon: CalendarBlankIcon, selected: period === value, keepOpen: true, onSelect: () => choose(setPeriod)(value) })) },
    {
      id: "kind",
      label: "Tipo",
      items: [
        { id: "kind-todas", label: "Entradas e saídas", selected: kind === "todas", keepOpen: true, onSelect: () => choose(setKind)("todas") },
        { id: "kind-income", label: "Entradas", icon: ArrowDownLeftIcon, count: inPeriod.filter((entry) => entry.kind === "income").length, selected: kind === "income", keepOpen: true, onSelect: () => choose(setKind)("income") },
        { id: "kind-expense", label: "Saídas", icon: ArrowUpRightIcon, count: inPeriod.filter((entry) => entry.kind === "expense").length, selected: kind === "expense", keepOpen: true, onSelect: () => choose(setKind)("expense") },
      ],
    },
    {
      id: "status",
      label: "Situação",
      items: [
        { id: "status-confirmadas", label: "Confirmadas", selected: status === "confirmadas", keepOpen: true, onSelect: () => choose(setStatus)("confirmadas") },
        { id: "status-estornadas", label: "Estornadas", icon: ArrowUUpLeftIcon, count: inPeriod.filter((entry) => entry.status === "cancelled").length, selected: status === "estornadas", keepOpen: true, onSelect: () => choose(setStatus)("estornadas") },
        { id: "status-todas", label: "Todas", selected: status === "todas", keepOpen: true, onSelect: () => choose(setStatus)("todas") },
      ],
    },
    ...(used.length > 1
      ? [
          {
            id: "account",
            label: "Conta",
            items: [
              { id: "account-all", label: "Todas as contas", selected: accountFilter === null, keepOpen: true, onSelect: () => choose(setAccountFilter)(null) },
              ...used.map((account) => ({ id: `account-${account.id}`, label: account.name, icon: BankIcon, selected: accountFilter === account.id, keepOpen: true, onSelect: () => choose(setAccountFilter)(account.id) })),
            ],
          },
        ]
      : []),
    ...(kind !== "todas" || status !== "confirmadas" || period !== "30" || accountFilter
      ? [{ id: "reset", items: [{ id: "reset", label: "Limpar filtros", icon: ArrowCounterClockwiseIcon, onSelect: () => (setKind("todas"), setStatus("confirmadas"), setPeriod("30"), setAccountFilter(null)) }] }]
      : []),
  ];

  const activeFilters = [
    ...(period !== "30" ? [{ id: "period", label: periods[period], icon: CalendarBlankIcon, onClear: () => setPeriod("30") }] : []),
    ...(kind !== "todas" ? [{ id: "kind", label: kind === "income" ? "Entradas" : "Saídas", icon: kind === "income" ? ArrowDownLeftIcon : ArrowUpRightIcon, onClear: () => setKind("todas") }] : []),
    ...(status !== "confirmadas" ? [{ id: "status", label: status === "estornadas" ? "Estornadas" : "Todas as situações", icon: PulseIcon, onClear: () => setStatus("confirmadas") }] : []),
    ...(filterAccount ? [{ id: "account", label: filterAccount.name, icon: BankIcon, onClear: () => setAccountFilter(null) }] : []),
  ];

  /* As colunas no desenho das tabelas da casa, reorganizadas em 2026-10-27 (a pedido: "a mesma pegada" de contas
     a receber): uma coisa por célula. A movimentação com a seta e o código embaixo, o valor com sinal, a data, o
     tipo (parcela, avulsa ou estornada, que tira a coluna de situação), e a categoria, a forma e a conta no fim. A
     descrição mora no recibo. */
  const typeOf = (entry: MovementEntry) =>
    entry.status === "cancelled"
      ? { tone: "neutral" as const, icon: ArrowUUpLeftIcon, label: "Estornada" }
      : entry.origin === "charge"
        ? { tone: "success" as const, icon: HandCoinsIcon, label: entry.kind === "expense" ? "Parcela paga" : "Parcela recebida" }
        : { tone: "indigo" as const, icon: ReceiptIcon, label: "Avulsa" };

  const columns: DataTableColumn<MovementEntry>[] = [
    {
      id: "title",
      header: "Movimentação",
      cell: (entry) => (
        <DataTableTitle
          title={entry.title}
          caption={entry.reference}
          onClick={() => setReceipt(entry)}
          media={
            <span className={styles.direction} data-kind={entry.kind} aria-hidden="true">
              {entry.kind === "income" ? <ArrowDownLeftIcon /> : <ArrowUpRightIcon />}
            </span>
          }
        />
      ),
    },
    {
      id: "amount",
      header: "Valor",
      align: "end",
      sortable: true,
      sortValue: (entry) => (entry.kind === "income" ? entry.amount : -entry.amount),
      cell: (entry) => (
        <Text as="span" variant="subheadline" weight="semibold" className={styles.amount} data-kind={entry.kind} data-reversed={entry.status === "cancelled" || undefined}>
          {signedMoney(entry.kind === "income" ? entry.amount : -entry.amount)}
        </Text>
      ),
    },
    { id: "date", header: "Data", sortable: true, sortValue: (entry) => entry.date, cell: (entry) => <DataTableDate iso={entry.date} /> },
    {
      id: "type",
      header: "Tipo",
      cell: (entry) => {
        const type = typeOf(entry);
        return (
          <Badge tone={type.tone} size="sm" icon={<type.icon />}>
            {type.label}
          </Badge>
        );
      },
    },
    {
      id: "category",
      header: "Categoria",
      hideBelow: "lg",
      cell: (entry) => {
        const category = categoryOf(entry.categoryId);
        if (!category) return <DataTableEmptyValue />;
        return (
          <span className={styles.chip} style={{ "--category": `var(--sys-${category.hue})` } as CSSProperties}>
            <i aria-hidden="true" />
            <Text as="span" variant="footnote" truncate>
              {category.name}
            </Text>
          </span>
        );
      },
    },
    {
      id: "method",
      header: "Forma",
      hideBelow: "lg",
      cell: (entry) => {
        if (!entry.method) return <DataTableEmptyValue />;
        const method = chargeMethods[entry.method];
        return (
          <span className={styles.chip}>
            <method.icon aria-hidden="true" />
            <Text as="span" variant="footnote">
              {method.label}
            </Text>
          </span>
        );
      },
    },
    {
      id: "account",
      header: "Conta",
      hideBelow: "lg",
      cell: (entry) => {
        const account = accountOf(entry.accountId);
        if (!account) return <DataTableEmptyValue />;
        return (
          <span className={styles.chip}>
            <AccountMark account={account} />
            <Text as="span" variant="footnote" truncate>
              {account.name}
            </Text>
          </span>
        );
      },
    },
  ];

  const receiptAccount = receipt ? accountOf(receipt.accountId) : null;
  const filtered = query !== "" || activeFilters.length > 0;

  return (
    <div className={styles.board}>
      <PageToolbar
        search={{ value: query, onChange: (value) => (setQuery(value), setPage(1)), placeholder: "Buscar movimentação", label: "Buscar movimentações por nome, descrição ou código" }}
        filters={filterSections}
        activeFilters={activeFilters}
        action={
          <>
            <span className={styles.wide}>
              <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => setCreating(true)}>
                Nova movimentação
              </Button>
            </span>
            <span className={styles.narrow}>
              <IconButton label="Nova movimentação" size="sm" radius="md" onClick={() => setCreating(true)}>
                <PlusIcon />
              </IconButton>
            </span>
          </>
        }
      />

      <div className={styles.table}>
        <DataTable
          label="Movimentações"
          rows={shown}
          rowKey={(entry) => entry.id}
          columns={columns}
          fill
          onRowClick={setReceipt}
          range={{ page: current, pageSize: PAGE_SIZE, total: visible.length }}
          footer={pageCount > 1 ? <Pagination page={current} pageSize={PAGE_SIZE} total={visible.length} onPageChange={setPage} label="Páginas de movimentações" /> : undefined}
          actions={(entry) => (
            <DropdownMenu
              label={`Ações de ${entry.title}`}
              triggerLabel={`Abrir ações de ${entry.title}`}
              size="sm"
              sections={[
                {
                  id: "actions",
                  items: [
                    { id: "receipt", label: "Ver o recibo", icon: ReceiptIcon, onSelect: () => setReceipt(entry) },
                    ...(entry.origin === "manual" && entry.status === "confirmed" ? [{ id: "edit", label: "Editar", icon: PencilSimpleIcon, onSelect: () => setEditing(entry) }] : []),
                    ...(entry.chargeId ? [{ id: "charge", label: entry.kind === "expense" ? "Abrir a despesa" : "Abrir a cobrança", icon: EyeIcon, onSelect: () => router.push(`${entry.kind === "expense" ? "/despesas" : "/cobrancas"}/${entry.chargeId}` as Route) }] : []),
                  ],
                },
                {
                  id: "danger",
                  items: [
                    ...(entry.status === "confirmed" ? [{ id: "reverse", label: "Estornar", icon: ArrowUUpLeftIcon, tone: "danger" as const, onSelect: () => setReversing(entry) }] : []),
                    ...(entry.origin === "manual" ? [{ id: "delete", label: "Excluir", icon: TrashIcon, tone: "danger" as const, onSelect: () => setRemoving(entry) }] : []),
                  ],
                },
              ].filter((section) => section.items.length > 0)}
            />
          )}
          empty={
            <EmptyState
              icon={ReceiptIcon}
              title={filtered ? "Nenhuma movimentação encontrada" : "Nenhuma movimentação no período"}
              description={filtered ? "Ajuste a busca ou os filtros." : "As baixas de parcela e os lançamentos avulsos aparecem aqui, com o recibo de cada um."}
            >
              {!filtered && (
                <Button size="sm" iconStart={<PlusIcon />} onClick={() => setCreating(true)}>
                  Nova movimentação
                </Button>
              )}
            </EmptyState>
          }
        />
      </div>

      <TransactionFormDialog
        open={creating || editing !== null}
        editing={editing}
        onClose={() => (setCreating(false), setEditing(null))}
        onCreated={() => {
          setCreating(false);
          setEditing(null);
          router.refresh();
        }}
      />

      {/* O recibo: só o ticket no palco e as ações no pé, sem cabeçalho (2026-10-27, a pedido: "a mesma pegada") */}
      <Dialog open={receipt !== null} onClose={() => setReceipt(null)} label={receipt ? `Recibo de ${receipt.title}` : "Recibo"} size="sm" surface="solid" focusOnOpen={false} className={styles.receipt}>
        {receipt && (
          <>
            <VisuallyHidden as="h2">{`Recibo ${receipt.reference}`}</VisuallyHidden>
            <div className={`${ticket.ticketStage} ${styles.receiptStage}`}>
              <PaymentSheet
                draft={{
                  direction: receipt.kind === "expense" ? "outgoing" : "incoming",
                  party: receipt.title,
                  description: receipt.description || (receipt.origin === "charge" ? "Baixa de parcela" : "Lançamento avulso"),
                  reference: receipt.reference,
                  amount: receipt.amount,
                  method: receipt.method,
                  date: receipt.date,
                  account: receiptAccount,
                  reversed: receipt.status === "cancelled",
                }}
              />
            </div>
            <footer className={styles.receiptFoot}>
              {receipt.status === "confirmed" && (
                <Button variant="ghost" size="sm" radius="md" iconStart={<ArrowUUpLeftIcon />} onClick={() => (setReversing(receipt), setReceipt(null))}>
                  Estornar
                </Button>
              )}
              <span className={styles.spacer} />
              {receipt.origin === "manual" && receipt.status === "confirmed" && (
                <Button variant="outline" size="sm" radius="md" iconStart={<PencilSimpleIcon />} onClick={() => (setEditing(receipt), setReceipt(null))}>
                  Editar
                </Button>
              )}
              <Button size="sm" radius="md" onClick={() => setReceipt(null)}>
                Fechar
              </Button>
            </footer>
          </>
        )}
      </Dialog>

      <ConfirmDialog
        open={reversing !== null}
        pending={pending}
        tone="danger"
        title="Estornar esta movimentação?"
        description={
          reversing
            ? reversing.origin === "charge"
              ? `A baixa de ${formatMoney(reversing.amount)} sai do caixa e a parcela volta a ficar pendente.`
              : `${formatMoney(reversing.amount)} sai do caixa. A movimentação continua na lista como estornada.`
            : ""
        }
        confirmLabel="Estornar"
        pendingLabel="Estornando"
        onClose={() => setReversing(null)}
        onConfirm={() => void reverse()}
      />
      <ConfirmDialog
        open={removing !== null}
        pending={pending}
        tone="danger"
        title="Excluir esta movimentação?"
        description={removing ? `${removing.title} some da lista e do caixa, sem deixar rastro. Para guardar o histórico, estorne em vez de excluir.` : ""}
        confirmLabel="Excluir"
        pendingLabel="Excluindo"
        onClose={() => setRemoving(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
