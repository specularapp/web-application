"use client";

import { ArrowCounterClockwiseIcon, ArrowUUpLeftIcon, ArrowsLeftRightIcon, BankIcon, CheckCircleIcon, PlusIcon, PulseIcon, ReceiptIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, DataTableDate, DataTableEmptyValue, DataTableMoney, DataTableTitle, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { callAction } from "@/lib/action";
import { formatMoney } from "@/lib/utils/format";
import { undoTransferAction } from "../accounts-actions";
import { accountDigits, accountIdentity, type FinanceTransfer, type TransfersScreenData } from "../accounts";
import type { ChargesView } from "../view-cookie";
import { AccountMark } from "./account-mark";
import { useFinanceView } from "./finance-view";
import { TransferCard } from "./transfer-card";
import type { Opened } from "./money";
import { TransferDialog, TransferReceiptDialog } from "./transfer-dialog";
import cards from "./finance-cards.module.css";
import styles from "./transfers-board.module.css";

type StatusFilter = "todas" | "feitas" | "desfeitas";

const PAGE_SIZE = 30;

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

/**
 * As transferências (2026-10-27, da Le Ange): o dinheiro que mudou de conta, uma por linha, de onde saiu e para
 * onde foi. Clicar na linha abre o comprovante; o leque desfaz, e o dinheiro volta para a conta de onde saiu. A
 * transferência desfeita continua na lista, para o extrato contar a história inteira.
 */
export function TransfersBoard({ accounts, transfers, today, view }: TransfersScreenData & { view: ChargesView }) {
  const router = useRouter();
  const { toast } = useToast();
  const { asTable, toolbar } = useFinanceView("transferencias", view);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todas");
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const [counter, setCounter] = useState(0);
  const [creating, setCreating] = useState<Opened<string | null>>(null);
  const [receipt, setReceipt] = useState<FinanceTransfer | null>(null);
  const [undoing, setUndoing] = useState<FinanceTransfer | null>(null);
  const [pending, setPending] = useState(false);
  const [page, setPage] = useState(1);

  const accountOf = (id: string) => accounts.find((account) => account.id === id) ?? null;
  const active = accounts.filter((account) => account.active);

  const visible = useMemo(() => {
    const search = normalize(query.trim());
    const nameOf = (id: string) => accounts.find((account) => account.id === id)?.name ?? "";
    return transfers.filter(
      (transfer) =>
        (status === "todas" || (status === "feitas" ? !transfer.undone : transfer.undone)) &&
        (!accountFilter || transfer.fromId === accountFilter || transfer.toId === accountFilter) &&
        (!search || normalize(`${transfer.reference} ${transfer.note} ${nameOf(transfer.fromId)} ${nameOf(transfer.toId)}`).includes(search)),
    );
  }, [transfers, accounts, query, status, accountFilter]);

  const openNew = () => {
    setCounter((current) => current + 1);
    setCreating({ key: counter + 1, value: null });
  };

  const undo = async () => {
    if (!undoing) return;
    setPending(true);
    const result = await callAction(undoTransferAction({ id: undoing.id }));
    setPending(false);
    if (!result.ok) {
      toast({ title: "Não deu para desfazer", description: result.error, tone: "danger" });
      return;
    }
    toast({ title: "Transferência desfeita", description: "O dinheiro voltou para a conta de onde saiu.", tone: "success" });
    setUndoing(null);
    router.refresh();
  };

  const used = accounts.filter((account) => transfers.some((transfer) => transfer.fromId === account.id || transfer.toId === account.id));
  const filterAccount = accountFilter ? accountOf(accountFilter) : null;

  const filterSections: DropdownSection[] = [
    {
      id: "status",
      label: "Situação",
      items: [
        { id: "status-todas", label: "Todas", selected: status === "todas", keepOpen: true, onSelect: () => setStatus("todas") },
        { id: "status-feitas", label: "Feitas", icon: CheckCircleIcon, count: transfers.filter((transfer) => !transfer.undone).length, selected: status === "feitas", keepOpen: true, onSelect: () => setStatus("feitas") },
        { id: "status-desfeitas", label: "Desfeitas", icon: ArrowUUpLeftIcon, count: transfers.filter((transfer) => transfer.undone).length, selected: status === "desfeitas", keepOpen: true, onSelect: () => setStatus("desfeitas") },
      ],
    },
    ...(used.length > 0
      ? [
          {
            id: "account",
            label: "Conta",
            items: [
              { id: "account-all", label: "Todas as contas", selected: accountFilter === null, keepOpen: true, onSelect: () => setAccountFilter(null) },
              ...used.map((account) => ({
                id: `account-${account.id}`,
                label: account.name,
                icon: BankIcon,
                count: transfers.filter((transfer) => transfer.fromId === account.id || transfer.toId === account.id).length,
                selected: accountFilter === account.id,
                keepOpen: true,
                onSelect: () => setAccountFilter(account.id),
              })),
            ],
          },
        ]
      : []),
    ...(status !== "todas" || accountFilter
      ? [{ id: "reset", items: [{ id: "reset", label: "Limpar filtros", icon: ArrowCounterClockwiseIcon, onSelect: () => (setStatus("todas"), setAccountFilter(null)) }] }]
      : []),
  ];

  const activeFilters = [
    ...(status !== "todas" ? [{ id: "status", label: status === "feitas" ? "Feitas" : "Desfeitas", icon: PulseIcon, onClear: () => setStatus("todas") }] : []),
    ...(filterAccount ? [{ id: "account", label: filterAccount.name, icon: BankIcon, onClear: () => setAccountFilter(null) }] : []),
  ];

  /* As colunas no desenho das tabelas da casa (2026-10-27, a pedido: "padronize tudo"): a transferência em
     título com o código embaixo, que abre o comprovante, as duas contas com a marca, o valor, a data e a
     situação, e o leque na ponta. */
  const accountCell = (id: string) => {
    const account = accountOf(id);
    if (!account) return <DataTableEmptyValue />;
    return <DataTableTitle title={account.name} caption={accountDigits(account) || accountIdentity(account).subtitle} media={<AccountMark account={account} />} />;
  };

  const columns: DataTableColumn<FinanceTransfer>[] = [
    {
      id: "title",
      header: "Transferência",
      cell: (transfer) => <DataTableTitle title={transfer.note || "Entre contas"} caption={transfer.reference} onClick={() => setReceipt(transfer)} />,
    },
    { id: "from", header: "De", hideBelow: "md", cell: (transfer) => accountCell(transfer.fromId) },
    { id: "to", header: "Para", hideBelow: "md", cell: (transfer) => accountCell(transfer.toId) },
    { id: "amount", header: "Valor", align: "end", sortable: true, sortValue: (transfer) => transfer.amount, cell: (transfer) => <DataTableMoney cents={transfer.amount} size="lg" /> },
    { id: "date", header: "Data", sortable: true, sortValue: (transfer) => `${transfer.date}${transfer.createdAt}`, cell: (transfer) => <DataTableDate iso={transfer.date} /> },
    {
      id: "status",
      header: "Situação",
      cell: (transfer) => (
        <Badge tone={transfer.undone ? "neutral" : "success"} size="sm" icon={transfer.undone ? <ArrowUUpLeftIcon /> : <CheckCircleIcon />}>
          {transfer.undone ? "Desfeita" : "Feita"}
        </Badge>
      ),
    },
  ];

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const shown = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const filtered = query !== "" || activeFilters.length > 0;

  // O leque e o vazio, os mesmos na tabela e nos cartões
  const menuOf = (transfer: FinanceTransfer) => (
    <DropdownMenu
      label={`Ações de ${transfer.reference}`}
      triggerLabel={`Abrir ações de ${transfer.reference}`}
      size="sm"
      sections={[
        { id: "actions", items: [{ id: "receipt", label: "Ver o comprovante", icon: ReceiptIcon, onSelect: () => setReceipt(transfer) }] },
        ...(transfer.undone ? [] : [{ id: "danger", items: [{ id: "undo", label: "Desfazer transferência", icon: ArrowUUpLeftIcon, tone: "danger" as const, onSelect: () => setUndoing(transfer) }] }]),
      ]}
    />
  );

  const empty = (
    <EmptyState
      icon={ArrowsLeftRightIcon}
      title={filtered ? "Nenhuma transferência encontrada" : "Nenhuma transferência feita"}
      description={filtered ? "Ajuste a busca ou os filtros." : "Os repasses da maquininha, os depósitos do caixa e o dinheiro que muda de banco aparecem aqui."}
    >
      {!filtered && active.length >= 2 && (
        <Button size="sm" iconStart={<PlusIcon />} onClick={openNew}>
          Nova transferência
        </Button>
      )}
    </EmptyState>
  );

  const pagination = pageCount > 1 ? <Pagination page={current} pageSize={PAGE_SIZE} total={visible.length} onPageChange={setPage} label="Páginas de transferências" /> : undefined;

  return (
    <div className={styles.board}>
      <PageToolbar
        search={{ value: query, onChange: (value) => (setQuery(value), setPage(1)), placeholder: "Buscar conta, motivo ou código", label: "Buscar transferências por conta, motivo ou código" }}
        filters={filterSections}
        activeFilters={activeFilters}
        view={toolbar}
        action={
          <>
            <span className={styles.wide}>
              <Button size="sm" radius="md" iconStart={<PlusIcon />} disabled={active.length < 2} onClick={openNew}>
                Nova transferência
              </Button>
            </span>
            <span className={styles.narrow}>
              <IconButton label="Nova transferência" size="sm" radius="md" disabled={active.length < 2} onClick={openNew}>
                <PlusIcon />
              </IconButton>
            </span>
          </>
        }
      />

      {asTable ? (
        <div className={styles.table}>
          <DataTable
            label="Transferências"
            rows={shown}
            rowKey={(transfer) => transfer.id}
            columns={columns}
            range={{ page: current, pageSize: PAGE_SIZE, total: visible.length }}
            footer={pagination}
            onRowClick={setReceipt}
            fill
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
              {shown.map((transfer) => (
                <li key={transfer.id}>
                  <TransferCard transfer={transfer} from={accountOf(transfer.fromId)} to={accountOf(transfer.toId)} menu={menuOf(transfer)} onOpen={() => setReceipt(transfer)} />
                </li>
              ))}
            </ul>
          )}
          {pagination && <div className={cards.pager}>{pagination}</div>}
        </div>
      )}

      <TransferDialog opened={creating} accounts={accounts} today={today} onClose={() => setCreating(null)} />
      <TransferReceiptDialog transfer={receipt} accounts={accounts} onClose={() => setReceipt(null)} />
      <ConfirmDialog
        open={undoing !== null}
        pending={pending}
        tone="danger"
        title="Desfazer esta transferência?"
        description={undoing ? `${formatMoney(undoing.amount)} voltam de ${accountOf(undoing.toId)?.name ?? "uma conta"} para ${accountOf(undoing.fromId)?.name ?? "outra"}. A transferência continua na lista como desfeita.` : ""}
        confirmLabel="Desfazer transferência"
        pendingLabel="Desfazendo"
        onClose={() => setUndoing(null)}
        onConfirm={() => void undo()}
      />
    </div>
  );
}
