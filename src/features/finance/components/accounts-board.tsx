"use client";

import {
  ArrowCounterClockwiseIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ArrowsLeftRightIcon,
  BankIcon,
  ListBulletsIcon,
  PencilSimpleIcon,
  PlusIcon,
  PowerIcon,
  ScalesIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { callAction } from "@/lib/action";
import { formatMoney } from "@/lib/utils/format";
import { deleteAccountAction, setAccountActiveAction } from "../accounts-actions";
import { accountDigits, accountIdentity, accountKinds, accountKindValues, signedOf, type AccountKind, type AccountMovement, type AccountsScreenData, type FinanceAccount } from "../accounts";
import { AccountEditor } from "./account-editor";
import type { ChargesView } from "../view-cookie";
import { AccountMark, accountTone } from "./account-mark";
import { AccountsTable } from "./accounts-table";
import { useFinanceView } from "./finance-view";
import { AdjustDialog } from "./adjust-dialog";
import { Sparkline } from "./sparkline";
import { StatementDialog } from "./statement-dialog";
import { TransferDialog } from "./transfer-dialog";
import type { Opened } from "./money";
import styles from "./accounts-board.module.css";

type StatusFilter = "todas" | "ativas" | "inativas";

/** Quantos dias a curva do saldo cobre: os mesmos 30 do que entrou e saiu. */
const DAYS = 30;

const dayBefore = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

/**
 * As contas bancárias (2026-10-27, da Le Ange): onde o dinheiro da empresa está. Cada conta é um cartão: a marca
 * do banco, o saldo de agora com a curva dos últimos 30 dias, o que entrou e saiu, o último movimento e os atalhos
 * para o extrato e a transferência. O saldo nunca é digitado: é a abertura mais os movimentos, e "Ajustar saldo"
 * lança a diferença para bater com o banco.
 */
export function AccountsBoard({ accounts, movements, today, view: saved }: AccountsScreenData & { view: ChargesView }) {
  const router = useRouter();
  const { toast } = useToast();
  // Tabela ou cartões, em cookie (2026-10-29); no celular, sempre os cartões, que cabem na largura.
  const { asTable, toolbar } = useFinanceView("contas", saved);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"todos" | AccountKind>("todos");
  const [status, setStatus] = useState<StatusFilter>("todas");
  const [counter, setCounter] = useState(0);
  const [editing, setEditing] = useState<Opened<FinanceAccount | null>>(null);
  const [transferring, setTransferring] = useState<Opened<string | null>>(null);
  const [adjusting, setAdjusting] = useState<Opened<FinanceAccount>>(null);
  const [statement, setStatement] = useState<FinanceAccount | null>(null);
  const [removing, setRemoving] = useState<FinanceAccount | null>(null);
  const [pending, setPending] = useState(false);

  const active = accounts.filter((account) => account.active);

  const open = <T,>(set: (value: Opened<T>) => void, value: T) => {
    setCounter((current) => current + 1);
    set({ key: counter + 1, value });
  };

  // A curva do saldo de cada conta (o fim de cada um dos últimos 30 dias) e o último movimento dela
  const history = useMemo(() => {
    const days = Array.from({ length: DAYS }, (_, index) => dayBefore(today, DAYS - 1 - index));
    const byAccount = new Map<string, AccountMovement[]>();
    for (const movement of movements) {
      const own = byAccount.get(movement.accountId);
      if (own) own.push(movement);
      else byAccount.set(movement.accountId, [movement]);
    }
    return new Map(
      accounts.map((account) => {
        const own = byAccount.get(account.id) ?? [];
        const curve = days.map((day) => account.balance - own.filter((movement) => movement.date > day).reduce((sum, movement) => sum + signedOf(movement), 0));
        return [account.id, { curve, last: own[0] ?? null }];
      }),
    );
  }, [accounts, movements, today]);

  const visible = useMemo(() => {
    const search = normalize(query.trim());
    return accounts
      .filter(
        (account) =>
          (kind === "todos" || account.kind === kind) &&
          (status === "todas" || (status === "ativas" ? account.active : !account.active)) &&
          (!search || normalize(`${account.name} ${accountIdentity(account).subtitle} ${account.lastDigits ?? ""}`).includes(search)),
      )
      .toSorted((a, b) => Number(b.active) - Number(a.active) || Number(b.isDefault) - Number(a.isDefault) || b.balance - a.balance);
  }, [accounts, query, kind, status]);

  const filterSections: DropdownSection[] = [
    {
      id: "kind",
      label: "Tipo",
      items: [
        { id: "kind-todos", label: "Todos os tipos", selected: kind === "todos", keepOpen: true, onSelect: () => setKind("todos") },
        ...accountKindValues.map((value) => ({
          id: `kind-${value}`,
          label: accountKinds[value].label,
          icon: accountKinds[value].icon,
          count: accounts.filter((account) => account.kind === value).length,
          selected: kind === value,
          keepOpen: true,
          onSelect: () => setKind(value),
        })),
      ],
    },
    {
      id: "status",
      label: "Situação",
      items: [
        { id: "status-todas", label: "Todas", selected: status === "todas", keepOpen: true, onSelect: () => setStatus("todas") },
        { id: "status-ativas", label: "Ativas", count: active.length, selected: status === "ativas", keepOpen: true, onSelect: () => setStatus("ativas") },
        { id: "status-inativas", label: "Inativas", count: accounts.length - active.length, selected: status === "inativas", keepOpen: true, onSelect: () => setStatus("inativas") },
      ],
    },
    ...(kind !== "todos" || status !== "todas"
      ? [{ id: "reset", items: [{ id: "reset", label: "Limpar filtros", icon: ArrowCounterClockwiseIcon, onSelect: () => (setKind("todos"), setStatus("todas")) }] }]
      : []),
  ];

  const activeFilters = [
    ...(kind !== "todos" ? [{ id: "kind", label: accountKinds[kind].label, icon: accountKinds[kind].icon, onClear: () => setKind("todos") }] : []),
    ...(status !== "todas" ? [{ id: "status", label: status === "ativas" ? "Ativas" : "Inativas", icon: PowerIcon, onClear: () => setStatus("todas") }] : []),
  ];

  const toggle = async (account: FinanceAccount) => {
    const result = await callAction(setAccountActiveAction({ id: account.id, active: !account.active }));
    if (!result.ok) {
      toast({ title: "Não deu para mudar", description: result.error, tone: "danger" });
      return;
    }
    toast({ title: account.active ? "Conta inativada" : "Conta ativada", description: account.active ? "Ela sai dos formulários e das somas." : "Ela volta aos formulários e às somas.", tone: "success" });
    router.refresh();
  };

  const remove = async () => {
    if (!removing) return;
    setPending(true);
    const result = await callAction(deleteAccountAction({ id: removing.id }));
    setPending(false);
    if (!result.ok) {
      toast({ title: "Não deu para excluir", description: result.error, tone: "danger" });
      return;
    }
    toast({ title: "Conta excluída", description: removing.name, tone: "success" });
    setRemoving(null);
    router.refresh();
  };

  const filtered = query !== "" || activeFilters.length > 0;

  // O leque de cada conta, o mesmo no cartão e na linha da tabela
  const menuOf = (account: FinanceAccount) => (
    <DropdownMenu
      label={`Ações de ${account.name}`}
      triggerLabel={`Abrir ações de ${account.name}`}
      size="sm"
      sections={[
        {
          id: "actions",
          items: [
            { id: "statement", label: "Ver extrato", icon: ListBulletsIcon, onSelect: () => setStatement(account) },
            ...(account.active && active.length > 1 ? [{ id: "transfer", label: "Transferir daqui", icon: ArrowsLeftRightIcon, onSelect: () => open(setTransferring, account.id) }] : []),
            ...(account.active ? [{ id: "adjust", label: "Ajustar saldo", icon: ScalesIcon, onSelect: () => open(setAdjusting, account) }] : []),
            { id: "edit", label: "Editar conta", icon: PencilSimpleIcon, onSelect: () => open(setEditing, account) },
          ],
        },
        ...(account.isDefault
          ? []
          : [
              {
                id: "danger",
                items: [
                  { id: "toggle", label: account.active ? "Inativar conta" : "Ativar conta", icon: PowerIcon, onSelect: () => void toggle(account) },
                  { id: "delete", label: "Excluir conta", icon: TrashIcon, tone: "danger" as const, onSelect: () => setRemoving(account) },
                ],
              },
            ]),
      ]}
    />
  );

  return (
    <div className={styles.board}>
      <PageToolbar
        search={{ value: query, onChange: setQuery, placeholder: "Buscar conta ou banco", label: "Buscar contas por nome, banco ou número" }}
        filters={filterSections}
        activeFilters={activeFilters}
        view={toolbar}
        action={
          <>
            {/* No celular os dois viram ícones, como o "+" das outras listas, para a busca caber na linha. */}
            <span className={styles.wide}>
              <Button variant="outline" size="sm" radius="md" iconStart={<ArrowsLeftRightIcon />} disabled={active.length < 2} onClick={() => open(setTransferring, null)}>
                Transferir
              </Button>
              <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => open(setEditing, null)}>
                Nova conta
              </Button>
            </span>
            <span className={styles.narrow}>
              <IconButton label="Transferir" variant="outline" size="sm" radius="md" disabled={active.length < 2} onClick={() => open(setTransferring, null)}>
                <ArrowsLeftRightIcon />
              </IconButton>
              <IconButton label="Nova conta" size="sm" radius="md" onClick={() => open(setEditing, null)}>
                <PlusIcon />
              </IconButton>
            </span>
          </>
        }
      />

      {asTable && visible.length > 0 ? (
        <div className={styles.tableArea}>
          <AccountsTable accounts={visible} lastOf={(account) => history.get(account.id)?.last ?? null} onOpen={setStatement} actionsOf={menuOf} />
        </div>
      ) : (
        <div className={styles.scroll}>
          {visible.length === 0 ? (
            <EmptyState
              icon={BankIcon}
              title={filtered ? "Nenhuma conta encontrada" : "Nenhuma conta cadastrada"}
              description={filtered ? "Ajuste a busca ou os filtros." : "Cadastre os bancos, as maquininhas e o caixa para registrar de onde o dinheiro sai e onde ele entra."}
            >
              {!filtered && (
                <Button size="sm" iconStart={<PlusIcon />} onClick={() => open(setEditing, null)}>
                  Criar conta
                </Button>
              )}
            </EmptyState>
          ) : (
            <div className={styles.grid}>
              {visible.map((account) => {
                const { title, subtitle } = accountIdentity(account);
                const { curve } = history.get(account.id) ?? { curve: [] };
                const flow = account.recentIn + account.recentOut;
                const digits = accountDigits(account);
                return (
                  <article key={account.id} className={styles.card} data-inactive={!account.active || undefined} style={accountTone(account)} aria-label={account.name}>
                    {/* A face: a marca e o saldo sobre o matiz da conta, com a curva dos últimos 30 dias no pé */}
                    <div className={styles.face}>
                      <header className={styles.faceHead}>
                        <AccountMark account={account} size="lg" />
                        <span className={styles.ident}>
                          <strong>{title}</strong>
                          <small>{subtitle}</small>
                        </span>
                        {menuOf(account)}
                      </header>
                      <div className={styles.balance}>
                        <span>Saldo atual</span>
                        <strong data-negative={account.balance < 0 || undefined}>{formatMoney(account.balance)}</strong>
                      </div>
                      <div className={styles.spark}>
                        <Sparkline values={curve} label={`Saldo de ${account.name} nos últimos 30 dias`} />
                      </div>
                    </div>

                    <div className={styles.details}>
                      <div className={styles.tags}>
                        <Badge tone={accountKinds[account.kind].tone} size="sm">
                          {accountKinds[account.kind].label}
                        </Badge>
                        {account.isDefault && (
                          <Badge tone="neutral" size="sm">
                            Padrão
                          </Badge>
                        )}
                        {!account.active && (
                          <Badge tone="warning" size="sm">
                            Inativa
                          </Badge>
                        )}
                        {digits && <span className={styles.digits}>{digits}</span>}
                      </div>

                      {/* O que entrou e saiu em 30 dias, com a barra que mostra a proporção entre os dois */}
                      <dl className={styles.flow}>
                        <div data-kind="in">
                          <span className={styles.flowIcon} aria-hidden="true">
                            <ArrowDownLeftIcon />
                          </span>
                          <span>
                            <dt>Entrou em 30 dias</dt>
                            <dd>{formatMoney(account.recentIn)}</dd>
                          </span>
                        </div>
                        <div data-kind="out">
                          <span className={styles.flowIcon} aria-hidden="true">
                            <ArrowUpRightIcon />
                          </span>
                          <span>
                            <dt>Saiu em 30 dias</dt>
                            <dd>{formatMoney(account.recentOut)}</dd>
                          </span>
                        </div>
                      </dl>
                      <span className={styles.flowBar} role="img" aria-label={flow > 0 ? `${Math.round((account.recentIn / flow) * 100)}% do movimento foi entrada` : "Sem movimento em 30 dias"}>
                        {flow > 0 && (
                          <>
                            <i data-kind="in" style={{ flexGrow: account.recentIn }} />
                            <i data-kind="out" style={{ flexGrow: account.recentOut }} />
                          </>
                        )}
                      </span>

                    </div>

                    <footer className={styles.actions}>
                      <Button variant="outline" size="sm" radius="md" iconStart={<ListBulletsIcon />} onClick={() => setStatement(account)}>
                        Extrato
                      </Button>
                      <Button variant="outline" size="sm" radius="md" iconStart={<ArrowsLeftRightIcon />} disabled={!account.active || active.length < 2} onClick={() => open(setTransferring, account.id)}>
                        Transferir
                      </Button>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      <AccountEditor opened={editing} today={today} onClose={() => setEditing(null)} />
      <TransferDialog opened={transferring} accounts={accounts} today={today} onClose={() => setTransferring(null)} />
      <AdjustDialog opened={adjusting} today={today} onClose={() => setAdjusting(null)} />
      <StatementDialog account={statement} movements={movements} today={today} onClose={() => setStatement(null)} />
      <ConfirmDialog
        open={removing !== null}
        pending={pending}
        tone="danger"
        title="Excluir esta conta?"
        description={removing ? `${removing.name} sai da lista. Só dá para excluir conta que nunca teve movimento; as outras se inativam, para o extrato não perder o histórico.` : ""}
        confirmLabel="Excluir conta"
        pendingLabel="Excluindo"
        onClose={() => setRemoving(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
