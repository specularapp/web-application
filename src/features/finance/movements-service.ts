import "server-only";
import { dbMessage, type DbError } from "@/lib/db/message";
import type { MovementEntry } from "./movements";
import type { UpdateTransactionInput } from "./schemas";
import type { FinanceClient } from "./service";

const FAILED = "Não foi possível concluir a operação. Tente de novo em instantes.";

const methodLabels = { pix: "Pix", card: "Cartão", boleto: "Boleto", transfer: "Transferência bancária", cash: "Dinheiro" } as const;

function ensureRead(error: DbError | null) {
  if (error) throw new Error(dbMessage(error, "Não foi possível ler as movimentações agora. Tente de novo em instantes."));
}

/** Tudo que entrou ou saiu da empresa, do mais novo ao mais antigo, com as estornadas no meio. */
export async function listMovements(client: FinanceClient, organizationId: string): Promise<MovementEntry[]> {
  const { data, error } = await client
    .from("transactions")
    .select("id, reference, kind, status, origin, title, description, amount, date, method_type, account_id, category_id, charge_id, visual_avatar_url, created_at")
    .eq("organization_id", organizationId)
    .in("origin", ["manual", "charge"])
    .in("kind", ["income", "expense"])
    .neq("status", "pending")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5000);

  ensureRead(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    reference: row.reference,
    kind: row.kind === "expense" ? "expense" : "income",
    status: row.status === "cancelled" ? "cancelled" : "confirmed",
    origin: row.origin === "charge" ? "charge" : "manual",
    title: row.title,
    description: row.description,
    amount: row.amount,
    date: row.date,
    method: row.method_type,
    accountId: row.account_id,
    categoryId: row.category_id,
    chargeId: row.charge_id,
    avatarUrl: row.visual_avatar_url,
  }));
}

export type MovementWriteResult = { ok: true } | { ok: false; error: string };

/** Editar só vale para a avulsa confirmada: a baixa de parcela se corrige reabrindo a parcela. */
export async function updateTransaction(client: FinanceClient, organizationId: string, input: UpdateTransactionInput): Promise<MovementWriteResult> {
  const { data, error } = await client
    .from("transactions")
    .update({
      kind: input.kind,
      title: input.title,
      description: input.description,
      amount: input.amount,
      date: input.date,
      method_type: input.method,
      method_label: input.method ? methodLabels[input.method] : null,
      category_id: input.categoryId ?? null,
      ...(input.accountId ? { account_id: input.accountId } : {}),
    })
    .eq("organization_id", organizationId)
    .eq("id", input.id)
    .eq("origin", "manual")
    .eq("status", "confirmed")
    .select("id");

  if (error) return { ok: false, error: dbMessage(error, FAILED) };
  if (!data?.length) return { ok: false, error: "Só dá para editar lançamento avulso que não foi estornado." };
  return { ok: true };
}

/**
 * Estornar (2026-10-27, da Le Ange): a avulsa fica na lista como estornada e sai do caixa; a baixa de parcela
 * reabre a parcela, pela mesma função do banco que a ficha da cobrança usa, e a parcela volta a ficar pendente.
 */
export async function reverseTransaction(client: FinanceClient, organizationId: string, id: string): Promise<MovementWriteResult> {
  const { data: row, error } = await client.from("transactions").select("origin, status, charge_id").eq("organization_id", organizationId).eq("id", id).maybeSingle();
  if (error) return { ok: false, error: dbMessage(error, FAILED) };
  if (!row) return { ok: false, error: "Essa movimentação não existe mais." };
  if (row.status === "cancelled") return { ok: false, error: "Essa movimentação já foi estornada." };

  if (row.origin === "charge" && row.charge_id) {
    const { data: installment } = await client.from("charge_installments").select("id").eq("organization_id", organizationId).eq("transaction_id", id).maybeSingle();
    if (!installment) return { ok: false, error: "A parcela dessa baixa não foi encontrada." };
    const { error: reopenError } = await client.rpc("change_charge_payment", {
      p_organization_id: organizationId,
      p_charge_id: row.charge_id,
      p_operation: "reopen",
      p_installment_id: installment.id,
    });
    return reopenError ? { ok: false, error: dbMessage(reopenError, FAILED) } : { ok: true };
  }

  if (row.origin !== "manual") return { ok: false, error: "Essa movimentação se desfaz pelo extrato da conta." };
  const { error: updateError } = await client.from("transactions").update({ status: "cancelled" }).eq("organization_id", organizationId).eq("id", id);
  return updateError ? { ok: false, error: dbMessage(updateError, FAILED) } : { ok: true };
}

/** Excluir só a avulsa: a baixa de parcela some reabrindo a parcela, e transferência se desfaz. */
export async function deleteTransaction(client: FinanceClient, organizationId: string, id: string): Promise<MovementWriteResult> {
  const { data, error } = await client.from("transactions").delete().eq("organization_id", organizationId).eq("id", id).eq("origin", "manual").select("id");
  if (error) return { ok: false, error: dbMessage(error, FAILED) };
  if (!data?.length) return { ok: false, error: "Só dá para excluir lançamento avulso." };
  return { ok: true };
}
