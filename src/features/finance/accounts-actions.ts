"use server";

import { firstIssue, guardAction, revalidateDomain } from "@/features/organizations/context";
import { cacheTags } from "@/lib/cache/tags";
import type { FinanceTransfer } from "./accounts";
import { adjustAccount, createTransfer, deleteAccount, listFinanceAccounts, saveAccount, setAccountActive, undoTransfer } from "./accounts-service";
import { listCategories } from "./installments-service";
import type { FinanceLookups } from "./movements";
import { deleteTransaction, reverseTransaction, updateTransaction } from "./movements-service";
import { accountIdSchema, adjustAccountSchema, createTransferSchema, saveAccountSchema, setAccountActiveSchema, transactionIdSchema, updateTransactionSchema } from "./schemas";

/*
 * As actions das contas bancárias e das transferências (2026-10-27): zod de novo no servidor, a regra no
 * `accounts-service.ts` e a RLS decidindo quem pode (contas só dono ou administrador; transferir, quem escreve).
 * Toda escrita derruba o cache do financeiro inteiro, porque o caixa da visão geral é a soma das contas.
 */

type Failure = { ok: false; error: string; field?: string };

const FINANCE_PATHS = ["/financeiro", "/financeiro/contas", "/financeiro/transferencias", "/financeiro/a-receber", "/financeiro/a-pagar", "/financeiro/movimentacoes", "/cobrancas", "/despesas", "/dashboard"];

async function refresh(organizationId: string) {
  await revalidateDomain(organizationId, [cacheTags.finance], FINANCE_PATHS);
}

export async function saveAccountAction(input: unknown): Promise<{ ok: true } | Failure> {
  const guard = await guardAction("finance-account-save");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = saveAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { supabase, organizationId, user } = guard.context;
  const result = await saveAccount(supabase, organizationId, user.id, parsed.data);
  if (!result.ok) return result;

  await refresh(organizationId);
  return { ok: true };
}

export async function setAccountActiveAction(input: unknown): Promise<{ ok: true } | Failure> {
  const guard = await guardAction("finance-account-active");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = setAccountActiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await setAccountActive(guard.context.supabase, guard.context.organizationId, parsed.data.id, parsed.data.active);
  if (!result.ok) return result;

  await refresh(guard.context.organizationId);
  return { ok: true };
}

export async function deleteAccountAction(input: unknown): Promise<{ ok: true } | Failure> {
  const guard = await guardAction("finance-account-delete");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = accountIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await deleteAccount(guard.context.supabase, guard.context.organizationId, parsed.data.id);
  if (!result.ok) return result;

  await refresh(guard.context.organizationId);
  return { ok: true };
}

export async function adjustAccountAction(input: unknown): Promise<{ ok: true } | Failure> {
  const guard = await guardAction("finance-account-adjust");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = adjustAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await adjustAccount(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!result.ok) return result;

  await refresh(guard.context.organizationId);
  return { ok: true };
}

export async function createTransferAction(input: unknown): Promise<{ ok: true; transfer: FinanceTransfer } | Failure> {
  const guard = await guardAction("finance-transfer-create");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = createTransferSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await createTransfer(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!result.ok) return result;

  await refresh(guard.context.organizationId);
  return result;
}

export async function undoTransferAction(input: unknown): Promise<{ ok: true } | Failure> {
  const guard = await guardAction("finance-transfer-undo");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = accountIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await undoTransfer(guard.context.supabase, guard.context.organizationId, parsed.data.id);
  if (!result.ok) return result;

  await refresh(guard.context.organizationId);
  return { ok: true };
}

/** As contas e as categorias, para as janelas que lançam sem ter recebido isso da página (2026-10-27). */
export async function loadFinanceLookupsAction(): Promise<{ ok: true; lookups: FinanceLookups } | Failure> {
  const guard = await guardAction("finance-lookups");
  if (!guard.ok) return { ok: false, error: guard.error };

  const { supabase, organizationId } = guard.context;
  const [accounts, categories] = await Promise.all([listFinanceAccounts(supabase, organizationId, []), listCategories(supabase, organizationId)]);
  return { ok: true, lookups: { accounts, categories } };
}

export async function updateTransactionAction(input: unknown): Promise<{ ok: true } | Failure> {
  const guard = await guardAction("finance-transaction-update");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = updateTransactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await updateTransaction(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!result.ok) return result;

  await refresh(guard.context.organizationId);
  return { ok: true };
}

export async function reverseTransactionAction(input: unknown): Promise<{ ok: true } | Failure> {
  const guard = await guardAction("finance-transaction-reverse");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = transactionIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await reverseTransaction(guard.context.supabase, guard.context.organizationId, parsed.data.id);
  if (!result.ok) return result;

  await refresh(guard.context.organizationId);
  return { ok: true };
}

export async function deleteTransactionAction(input: unknown): Promise<{ ok: true } | Failure> {
  const guard = await guardAction("finance-transaction-delete");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = transactionIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await deleteTransaction(guard.context.supabase, guard.context.organizationId, parsed.data.id);
  if (!result.ok) return result;

  await refresh(guard.context.organizationId);
  return { ok: true };
}
