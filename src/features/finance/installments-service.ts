import "server-only";
import { dbMessage, type DbError } from "@/lib/db/message";
import { houseDay } from "@/lib/utils/day";
import type { FinanceCategory, InstallmentEntry, InstallmentStatus } from "./installments";
import type { FinanceClient } from "./service";
import type { ChargeDirection } from "./summary";

/* Quantas parcelas a tela lê de uma vez: a situação é derivada, então o filtro e a ordem são da tela. */
const LIMIT = 5000;

function ensureRead(error: DbError | null) {
  if (error) throw new Error(dbMessage(error, "Não foi possível ler as parcelas agora. Tente de novo em instantes."));
}

/**
 * As parcelas de um lado (cobranças ou despesas), com o que a linha mostra da cobrança: título, número,
 * contraparte, forma, categoria e a conta. A conta da parcela paga é a da movimentação que a baixa gerou; a da
 * aberta é a que a cobrança combinou (2026-10-27).
 */
export async function listInstallments(client: FinanceClient, organizationId: string, direction: ChargeDirection): Promise<InstallmentEntry[]> {
  const { data, error } = await client
    .from("charge_installments")
    .select(
      "id, charge_id, number, amount, due_date, paid_at, paid_method, reported, transactions(account_id), charges!inner(title, reference, direction, method, client_name, client_company, client_avatar_url, image_url, client_id, cancelled_at, account_id, category_id, charge_installments(count))",
    )
    .eq("organization_id", organizationId)
    .eq("charges.direction", direction)
    .order("due_date")
    .order("number")
    .limit(LIMIT);

  ensureRead(error);

  const today = houseDay();
  return (data ?? []).map((row) => {
    const charge = row.charges;
    const paidOn = row.paid_at ? row.paid_at.slice(0, 10) : null;
    const status: InstallmentStatus = paidOn ? "paid" : charge.cancelled_at ? "cancelled" : row.due_date < today ? "overdue" : "open";
    const standalone = !charge.client_id && !charge.client_name;
    return {
      id: row.id,
      chargeId: row.charge_id,
      direction: charge.direction,
      number: row.number,
      count: charge.charge_installments[0]?.count ?? 1,
      amount: row.amount,
      dueDate: row.due_date,
      paidOn,
      paidMethod: row.paid_method,
      reported: row.reported,
      status,
      title: charge.title,
      reference: charge.reference,
      party: {
        name: charge.client_name ?? charge.title,
        company: charge.client_company,
        avatarUrl: charge.client_avatar_url ?? charge.image_url,
        standalone,
      },
      method: charge.method,
      categoryId: charge.category_id,
      accountId: row.transactions?.account_id ?? charge.account_id,
    };
  });
}

export async function listCategories(client: FinanceClient, organizationId: string): Promise<FinanceCategory[]> {
  const { data, error } = await client
    .from("finance_categories")
    .select("id, kind, name, nature, hue")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("kind")
    .order("position");

  ensureRead(error);
  return data ?? [];
}
