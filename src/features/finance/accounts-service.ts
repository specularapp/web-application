import "server-only";
import { dbMessage, type DbError } from "@/lib/db/message";
import { houseDay, houseDayWithOffset } from "@/lib/utils/day";
import type { Database } from "@/types/database";
import { isFlow, type AccountMovement, type FinanceAccount, type FinanceTransfer } from "./accounts";
import type { AdjustAccountInput, CreateTransferInput, SaveAccountInput } from "./schemas";
import type { FinanceClient } from "./service";

/*
 * Contas bancárias, ajuste de saldo e transferências contra o banco (2026-10-27, fase 2 da vinda do financeiro
 * da Le Ange). O saldo nunca sai daqui calculado à mão: vem da view `finance_account_balances`; transferir,
 * desfazer e ajustar são funções do banco, que travam as contas e fazem tudo de uma vez.
 */

type AccountRow = Database["public"]["Tables"]["finance_accounts"]["Row"];
type TransferRow = Database["public"]["Tables"]["finance_transfers"]["Row"];

export type AccountWriteResult = { ok: true } | { ok: false; error: string };

/** Quantos movimentos a tela de contas lê: o extrato e a curva do cartão filtram dentro disso. */
const MOVEMENTS_LIMIT = 5000;

const FAILED = "Não foi possível concluir a operação. Tente de novo em instantes.";

function ensureRead(error: DbError | null) {
  if (error) throw new Error(dbMessage(error, "Não foi possível ler as contas agora. Tente de novo em instantes."));
}

const toMovement = (row: {
  id: string;
  account_id: string;
  kind: Database["public"]["Enums"]["transaction_kind"];
  amount: number;
  date: string;
  title: string;
  description: string;
  origin: Database["public"]["Enums"]["transaction_origin"];
  created_at: string;
}): AccountMovement => ({
  id: row.id,
  accountId: row.account_id,
  kind: row.kind === "income" ? "in" : "out",
  amount: row.amount,
  date: row.date,
  title: row.title,
  description: row.description,
  origin: row.origin,
  createdAt: row.created_at,
});

const toTransfer = (row: TransferRow): FinanceTransfer => ({
  id: row.id,
  reference: row.reference,
  fromId: row.from_account_id,
  toId: row.to_account_id,
  amount: row.amount,
  date: row.date,
  note: row.note,
  undone: row.undone_at !== null,
  createdAt: row.created_at,
});

/** Os movimentos confirmados de todas as contas, do mais novo ao mais antigo. */
export async function listAccountMovements(client: FinanceClient, organizationId: string): Promise<AccountMovement[]> {
  const { data, error } = await client
    .from("transactions")
    .select("id, account_id, kind, amount, date, title, description, origin, created_at")
    .eq("organization_id", organizationId)
    .eq("status", "confirmed")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MOVEMENTS_LIMIT);

  ensureRead(error);
  return (data ?? []).map(toMovement);
}

/**
 * As contas com o saldo de agora e o que entrou e saiu nos últimos 30 dias. Os 30 dias contam hoje, como na Le
 * Ange, e só o que é dinheiro da empresa: transferência e ajuste mexem no saldo e ficam fora do "entrou e saiu".
 */
export async function listFinanceAccounts(client: FinanceClient, organizationId: string, movements: AccountMovement[]): Promise<FinanceAccount[]> {
  const [{ data: rows, error }, { data: balances, error: balancesError }] = await Promise.all([
    client.from("finance_accounts").select("*").eq("organization_id", organizationId).order("position").order("created_at"),
    client.from("finance_account_balances").select("account_id, balance").eq("organization_id", organizationId),
  ]);

  ensureRead(error);
  ensureRead(balancesError);

  const since = houseDayWithOffset(-29);
  const balanceOf = new Map((balances ?? []).map((row) => [row.account_id, row.balance ?? 0]));

  return (rows ?? []).map((row: AccountRow) => {
    const recent = movements.filter((movement) => movement.accountId === row.id && movement.date >= since && isFlow(movement.origin));
    const sum = (kind: AccountMovement["kind"]) => recent.filter((movement) => movement.kind === kind).reduce((total, movement) => total + movement.amount, 0);
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      bank: row.bank,
      agency: row.agency,
      lastDigits: row.last_digits,
      hue: row.hue,
      openingBalance: row.opening_balance,
      openingDate: row.opening_date,
      isDefault: row.is_default,
      active: row.active,
      balance: balanceOf.get(row.id) ?? row.opening_balance,
      recentIn: sum("in"),
      recentOut: sum("out"),
    };
  });
}

export async function listTransfers(client: FinanceClient, organizationId: string): Promise<FinanceTransfer[]> {
  const { data, error } = await client
    .from("finance_transfers")
    .select("*")
    .eq("organization_id", organizationId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(2000);

  ensureRead(error);
  return (data ?? []).map(toTransfer);
}

/**
 * Cria ou edita uma conta. Virar a padrão tira a marca da antiga antes, porque o índice único não espera o fim
 * da transação; se a segunda escrita falhar, a equipe fica um instante sem padrão e o lançamento sem conta é
 * recusado, que é melhor do que duas padrão.
 */
export async function saveAccount(client: FinanceClient, organizationId: string, userId: string, input: SaveAccountInput): Promise<AccountWriteResult> {
  const fields = {
    name: input.name,
    kind: input.kind,
    bank: input.kind === "cash" ? null : input.bank,
    agency: input.kind === "cash" ? null : input.agency,
    last_digits: input.kind === "cash" ? null : input.lastDigits,
    hue: input.hue,
    opening_balance: input.openingBalance,
    opening_date: input.openingDate,
  };

  if (input.isDefault) {
    const { error } = await client
      .from("finance_accounts")
      .update({ is_default: false })
      .eq("organization_id", organizationId)
      .eq("is_default", true)
      .neq("id", input.id ?? "00000000-0000-0000-0000-000000000000");
    if (error) return { ok: false, error: dbMessage(error, FAILED) };
  }

  if (input.id) {
    const { error } = await client
      .from("finance_accounts")
      .update({ ...fields, ...(input.isDefault ? { is_default: true, active: true } : {}) })
      .eq("organization_id", organizationId)
      .eq("id", input.id);
    return error ? { ok: false, error: nameMessage(error) } : { ok: true };
  }

  const { count } = await client.from("finance_accounts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
  const { error } = await client.from("finance_accounts").insert({
    ...fields,
    organization_id: organizationId,
    is_default: input.isDefault,
    position: count ?? 0,
    created_by: userId,
  });
  return error ? { ok: false, error: nameMessage(error) } : { ok: true };
}

/** Nome repetido é o erro mais provável ao salvar uma conta, e merece o recado dele. */
const nameMessage = (error: DbError) => (error.code === "23505" ? "Já existe uma conta com esse nome." : dbMessage(error, FAILED));

/** Inativar ou reativar. O banco recusa inativar a padrão ou uma conta com dinheiro, com o recado dele. */
export async function setAccountActive(client: FinanceClient, organizationId: string, id: string, active: boolean): Promise<AccountWriteResult> {
  const { error } = await client.from("finance_accounts").update({ active }).eq("organization_id", organizationId).eq("id", id);
  return error ? { ok: false, error: dbMessage(error, FAILED) } : { ok: true };
}

/**
 * Excluir só vale para conta que nunca teve movimento: o banco recusa apagar conta com lançamento (a chave é
 * `restrict`), e o recado diz para inativar, que guarda o extrato.
 */
export async function deleteAccount(client: FinanceClient, organizationId: string, id: string): Promise<AccountWriteResult> {
  const { data: account } = await client.from("finance_accounts").select("is_default").eq("organization_id", organizationId).eq("id", id).maybeSingle();
  if (account?.is_default) return { ok: false, error: "A conta padrão não pode ser excluída." };

  const { error } = await client.from("finance_accounts").delete().eq("organization_id", organizationId).eq("id", id);
  if (error?.code === "23503") return { ok: false, error: "Essa conta já tem movimentos. Inative em vez de excluir, para o extrato não perder o histórico." };
  return error ? { ok: false, error: dbMessage(error, FAILED) } : { ok: true };
}

export async function adjustAccount(client: FinanceClient, organizationId: string, input: AdjustAccountInput): Promise<AccountWriteResult> {
  const { error } = await client.rpc("adjust_finance_account", {
    p_organization_id: organizationId,
    p_account_id: input.id,
    p_balance: input.balance,
    p_date: input.date,
    p_note: input.note,
  });
  return error ? { ok: false, error: dbMessage(error, FAILED) } : { ok: true };
}

export type TransferResult = { ok: true; transfer: FinanceTransfer } | { ok: false; error: string };

export async function createTransfer(client: FinanceClient, organizationId: string, input: CreateTransferInput): Promise<TransferResult> {
  const { data: id, error } = await client.rpc("create_finance_transfer", {
    p_organization_id: organizationId,
    p_from_account_id: input.fromId,
    p_to_account_id: input.toId,
    p_amount: input.amount,
    p_date: input.date,
    p_note: input.note,
  });
  if (error || !id) return { ok: false, error: dbMessage(error, FAILED) };

  const { data, error: readError } = await client.from("finance_transfers").select("*").eq("id", id).single();
  if (readError || !data) return { ok: false, error: dbMessage(readError, FAILED) };
  return { ok: true, transfer: toTransfer(data) };
}

export async function undoTransfer(client: FinanceClient, organizationId: string, id: string): Promise<AccountWriteResult> {
  const { error } = await client.rpc("undo_finance_transfer", { p_organization_id: organizationId, p_transfer_id: id });
  return error ? { ok: false, error: dbMessage(error, FAILED) } : { ok: true };
}

/** O dia de hoje no fuso da casa, para as datas máximas dos formulários. */
export const financeToday = () => houseDay();
