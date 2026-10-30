"use client";

import { ArrowCounterClockwiseIcon, CalendarBlankIcon, CheckCircleIcon, EyeIcon, HandCoinsIcon, PulseIcon, TagIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState, type CSSProperties } from "react";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, DataTableDate, DataTableEmptyValue, DataTableMoney, DataTableTitle, type DataTableColumn } from "@/components/ui/data-table";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Text } from "@/components/ui/text";
import { callAction } from "@/lib/action";
import { formatMoney } from "@/lib/utils/format";
import { reopenInstallmentAction } from "../actions";
import { installmentSides, installmentStatuses, isPending, reopenIcon, type InstallmentEntry, type InstallmentStatus, type InstallmentsScreenData } from "../installments";
import { dueLabel, dueTone } from "../labels";
import type { ChargesView } from "../view-cookie";
import { AccountMark } from "./account-mark";
import { useFinanceView } from "./finance-view";
import { InstallmentCard } from "./installment-card";
import { dayBefore, dayMonth, type Opened } from "./money";
import { SettleDialog } from "./settle-dialog";
import cards from "./finance-cards.module.css";
import styles from "./installments-board.module.css";

type StatusFilter = "pendentes" | InstallmentStatus | "todas";
type DueFilter = "todos" | "semana" | "mes" | "30" | "vencidas";

const PAGE_SIZE = 30;

const dueFilters: Record<DueFilter, string> = { todos: "Qualquer vencimento", vencidas: "Já vencidas", semana: "Próximos 7 dias", "30": "Próximos 30 dias", mes: "Este mês" };

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

/**
 * Contas a receber e contas a pagar (2026-10-27, da Le Ange): uma linha por parcela, no desenho das tabelas da
 * casa. Abre nas pendentes (em aberto e atrasadas), pelo vencimento mais perto. Clicar numa pendente abre a janela
 * de receber ou pagar; numa baixada, a cobrança. O leque baixa, abre a cobrança ou reabre a parcela baixada.
 */
export function InstallmentsBoard({ direction, entries, accounts, categories, today, view }: InstallmentsScreenData & { view: ChargesView }) {
  const router = useRouter();
  const { toast } = useToast();
  const side = installmentSides[direction];
  const { asTable, toolbar } = useFinanceView(direction === "outgoing" ? "pagar" : "receber", view);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("pendentes");
  const [due, setDue] = useState<DueFilter>("todos");
  const [category, setCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [counter, setCounter] = useState(0);
  const [settling, setSettling] = useState<Opened<InstallmentEntry>>(null);
  const [reopening, setReopening] = useState<InstallmentEntry | null>(null);
  const [pending, setPending] = useState(false);

  const accountOf = (id: string | null) => accounts.find((account) => account.id === id) ?? null;
  const categoryOf = (id: string | null) => categories.find((entry) => entry.id === id) ?? null;
  const chargePath = (entry: InstallmentEntry) => `${direction === "outgoing" ? "/despesas" : "/cobrancas"}/${entry.chargeId}` as Route;

  const matchesDue = (entry: InstallmentEntry) => {
    if (due === "todos") return true;
    if (due === "vencidas") return entry.dueDate < today;
    if (due === "mes") return entry.dueDate.slice(0, 7) === today.slice(0, 7);
    const limit = dayBefore(today, due === "semana" ? -7 : -30);
    return entry.dueDate >= today && entry.dueDate <= limit;
  };

  const matchesStatus = (entry: InstallmentEntry, filter: StatusFilter) => (filter === "todas" ? true : filter === "pendentes" ? isPending(entry.status) : entry.status === filter);

  const visible = useMemo(() => {
    const search = normalize(query.trim());
    const rows = entries.filter(
      (entry) =>
        matchesStatus(entry, status) &&
        matchesDue(entry) &&
        (!category || entry.categoryId === category) &&
        (!search || normalize(`${entry.title} ${entry.reference} ${entry.party.name} ${entry.party.company ?? ""}`).includes(search)),
    );
    // Pendentes pelo vencimento mais perto; baixadas pela baixa mais recente
    return status === "paid" ? rows.toSorted((a, b) => (b.paidOn ?? "").localeCompare(a.paidOn ?? "")) : rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, query, status, due, category, today]);


  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const shown = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const openSettle = (entry: InstallmentEntry) => {
    setCounter((value) => value + 1);
    setSettling({ key: counter + 1, value: entry });
  };

  const openRow = (entry: InstallmentEntry) => (isPending(entry.status) ? openSettle(entry) : router.push(chargePath(entry)));

  const reopen = async () => {
    if (!reopening) return;
    setPending(true);
    const result = await callAction(reopenInstallmentAction({ id: reopening.chargeId, installmentId: reopening.id }));
    setPending(false);
    if (!result.ok) {
      toast({ title: "Não deu para reabrir", description: result.error, tone: "danger" });
      return;
    }
    toast({ title: "Parcela reaberta", description: `${formatMoney(reopening.amount)} voltou para ${side.page.toLocaleLowerCase("pt-BR")}.`, tone: "success" });
    setReopening(null);
    router.refresh();
  };

  const usedCategories = categories.filter((entry) => entries.some((row) => row.categoryId === entry.id));
  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "pendentes", label: "Pendentes" },
    { value: "overdue", label: installmentStatuses.overdue.label[direction] },
    { value: "open", label: installmentStatuses.open.label[direction] },
    { value: "paid", label: installmentStatuses.paid.label[direction] },
    { value: "cancelled", label: installmentStatuses.cancelled.label[direction] },
    { value: "todas", label: "Todas" },
  ];

  const filterSections: DropdownSection[] = [
    {
      id: "status",
      label: "Situação",
      items: statusOptions.map((option) => ({
        id: `status-${option.value}`,
        label: option.label,
        count: option.value === "todas" ? undefined : entries.filter((entry) => matchesStatus(entry, option.value)).length,
        selected: status === option.value,
        keepOpen: true,
        onSelect: () => (setStatus(option.value), setPage(1)),
      })),
    },
    {
      id: "due",
      label: "Vencimento",
      items: (Object.keys(dueFilters) as DueFilter[]).map((value) => ({ id: `due-${value}`, label: dueFilters[value], icon: CalendarBlankIcon, selected: due === value, keepOpen: true, onSelect: () => (setDue(value), setPage(1)) })),
    },
    ...(usedCategories.length > 0
      ? [
          {
            id: "category",
            label: "Categoria",
            items: [
              { id: "category-all", label: "Todas as categorias", selected: category === null, keepOpen: true, onSelect: () => setCategory(null) },
              ...usedCategories.map((entry) => ({ id: `category-${entry.id}`, label: entry.name, icon: TagIcon, selected: category === entry.id, keepOpen: true, onSelect: () => (setCategory(entry.id), setPage(1)) })),
            ],
          },
        ]
      : []),
    ...(status !== "pendentes" || due !== "todos" || category
      ? [{ id: "reset", items: [{ id: "reset", label: "Limpar filtros", icon: ArrowCounterClockwiseIcon, onSelect: () => (setStatus("pendentes"), setDue("todos"), setCategory(null)) }] }]
      : []),
  ];

  const activeFilters = [
    ...(status !== "pendentes" ? [{ id: "status", label: statusOptions.find((option) => option.value === status)?.label ?? "", icon: PulseIcon, onClear: () => setStatus("pendentes") }] : []),
    ...(due !== "todos" ? [{ id: "due", label: dueFilters[due], icon: CalendarBlankIcon, onClear: () => setDue("todos") }] : []),
    ...(category ? [{ id: "category", label: categoryOf(category)?.name ?? "Categoria", icon: TagIcon, onClear: () => setCategory(null) }] : []),
  ];

  /* As colunas no desenho das tabelas da casa, reorganizadas em 2026-10-27 (a pedido: "a linha está meio bagunçada
     e muito apertada"): a cobrança com o número embaixo, a contraparte, o valor, o vencimento numa data só, a
     situação já dizendo o prazo ("Vence em 3 dias", "Venceu há 2 dias", "Recebida em 05/11"), a parcela ao lado do
     valor ("2/3", como o "3x" dos orçamentos), e a categoria e a conta no fim, que são o detalhe. */
  const statusOf = (entry: InstallmentEntry) => {
    if (entry.status === "paid") return { tone: "success" as const, icon: installmentStatuses.paid.icon, label: `${installmentStatuses.paid.label[direction]} em ${dayMonth(entry.paidOn ?? entry.dueDate)}` };
    if (entry.status === "cancelled") return { tone: "neutral" as const, icon: installmentStatuses.cancelled.icon, label: installmentStatuses.cancelled.label[direction] };
    if (entry.reported) return { tone: "info" as const, icon: installmentStatuses.open.icon, label: "Pagamento avisado" };
    const meta = installmentStatuses[entry.status];
    return { tone: dueTone(entry.dueDate, today), icon: meta.icon, label: dueLabel(entry.dueDate, today) };
  };

  const columns: DataTableColumn<InstallmentEntry>[] = [
    {
      id: "title",
      header: direction === "outgoing" ? "Despesa" : "Cobrança",
      cell: (entry) => <DataTableTitle title={entry.title} caption={entry.reference} onClick={() => openRow(entry)} />,
    },
    {
      id: "party",
      header: side.party,
      hideBelow: "md",
      cell: (entry) =>
        entry.party.standalone ? (
          <DataTableEmptyValue />
        ) : (
          <DataTableTitle
            title={entry.party.company ?? entry.party.name}
            caption={entry.party.company ? entry.party.name : undefined}
            media={<Avatar name={entry.party.name} src={entry.party.avatarUrl ?? undefined} size="xs" />}
          />
        ),
    },
    {
      id: "amount",
      header: "Valor",
      align: "end",
      sortable: true,
      sortValue: (entry) => entry.amount,
      cell: (entry) => (
        <span className={styles.amount}>
          <DataTableMoney cents={entry.amount} size="lg" />
          {entry.count > 1 && (
            <Text as="span" variant="caption1" tone="tertiary" numeric>
              {entry.number}/{entry.count}
            </Text>
          )}
        </span>
      ),
    },
    { id: "due", header: "Vencimento", sortable: true, sortValue: (entry) => entry.dueDate, cell: (entry) => <DataTableDate iso={entry.dueDate} /> },
    {
      id: "status",
      header: "Situação",
      cell: (entry) => {
        const status = statusOf(entry);
        return (
          <Badge tone={status.tone} size="sm" icon={<status.icon />}>
            {status.label}
          </Badge>
        );
      },
    },
    {
      id: "category",
      header: "Categoria",
      hideBelow: "lg",
      cell: (entry) => {
        const found = categoryOf(entry.categoryId);
        if (!found) return <DataTableEmptyValue />;
        return (
          <span className={styles.category} style={{ "--category": `var(--sys-${found.hue})` } as CSSProperties}>
            <i aria-hidden="true" />
            <Text as="span" variant="footnote" truncate>
              {found.name}
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
        const account = accountOf(entry.accountId) ?? accounts.find((candidate) => candidate.isDefault) ?? null;
        if (!account) return <DataTableEmptyValue />;
        return (
          <span className={styles.account}>
            <AccountMark account={account} />
            <Text as="span" variant="footnote" truncate>
              {account.name}
            </Text>
          </span>
        );
      },
    },
  ];

  const filtered = query !== "" || activeFilters.length > 0;

  // O leque e o vazio, os mesmos na tabela e nos cartões
  const menuOf = (entry: InstallmentEntry) => (
    <DropdownMenu
      label={`Ações de ${entry.title}`}
      triggerLabel={`Abrir ações de ${entry.title}`}
      size="sm"
      sections={[
        {
          id: "actions",
          items: [
            ...(isPending(entry.status) ? [{ id: "settle", label: side.settleTitle, icon: direction === "outgoing" ? CheckCircleIcon : HandCoinsIcon, onSelect: () => openSettle(entry) }] : []),
            { id: "open", label: direction === "outgoing" ? "Abrir a despesa" : "Abrir a cobrança", icon: EyeIcon, onSelect: () => router.push(chargePath(entry)) },
          ],
        },
        ...(entry.status === "paid" ? [{ id: "danger", items: [{ id: "reopen", label: "Reabrir a parcela", icon: reopenIcon, tone: "danger" as const, onSelect: () => setReopening(entry) }] }] : []),
      ]}
    />
  );

  const empty = (
    <EmptyState
      icon={HandCoinsIcon}
      title={filtered ? "Nenhuma parcela encontrada" : status === "pendentes" ? "Nada pendente" : "Nenhuma parcela"}
      description={
        filtered
          ? "Ajuste a busca ou os filtros."
          : direction === "outgoing"
            ? "As parcelas das despesas aparecem aqui, pelo vencimento, até serem pagas."
            : "As parcelas das cobranças aparecem aqui, pelo vencimento, até serem recebidas."
      }
    />
  );

  const pagination = pageCount > 1 ? <Pagination page={current} pageSize={PAGE_SIZE} total={visible.length} onPageChange={setPage} label={`Páginas de ${side.page.toLocaleLowerCase("pt-BR")}`} /> : undefined;

  return (
    <div className={styles.board}>
      <PageToolbar
        search={{ value: query, onChange: (value) => (setQuery(value), setPage(1)), placeholder: `Buscar ${direction === "outgoing" ? "despesa ou fornecedor" : "cobrança ou cliente"}`, label: `Buscar ${side.page.toLocaleLowerCase("pt-BR")} por título, número ou ${side.party.toLocaleLowerCase("pt-BR")}` }}
        filters={filterSections}
        activeFilters={activeFilters}
        view={toolbar}
      />

      {asTable ? (
        <div className={styles.table}>
          <DataTable
            label={side.page}
            rows={shown}
            rowKey={(entry) => entry.id}
            columns={columns}
            fill
            onRowClick={openRow}
            range={{ page: current, pageSize: PAGE_SIZE, total: visible.length }}
            footer={pagination}
            actions={menuOf}
            empty={empty}
          />
        </div>
      ) : (
        <div className={cards.area}>
          {shown.length === 0 ? (
            empty
          ) : (
            <ul className={cards.grid}>
              {shown.map((entry) => (
                <li key={entry.id}>
                  <InstallmentCard
                    entry={entry}
                    due={statusOf(entry)}
                    category={categoryOf(entry.categoryId)}
                    account={accountOf(entry.accountId) ?? accounts.find((candidate) => candidate.isDefault) ?? null}
                    menu={menuOf(entry)}
                    onOpen={() => openRow(entry)}
                  />
                </li>
              ))}
            </ul>
          )}
          {pagination && <div className={cards.pager}>{pagination}</div>}
        </div>
      )}

      <SettleDialog opened={settling} accounts={accounts} categories={categories} today={today} onClose={() => setSettling(null)} />
      <ConfirmDialog
        open={reopening !== null}
        pending={pending}
        tone="danger"
        title="Reabrir esta parcela?"
        description={reopening ? `A baixa de ${formatMoney(reopening.amount)} sai do caixa e a parcela volta a ficar em aberto.` : ""}
        confirmLabel="Reabrir a parcela"
        pendingLabel="Reabrindo"
        onClose={() => setReopening(null)}
        onConfirm={() => void reopen()}
      />
    </div>
  );
}
