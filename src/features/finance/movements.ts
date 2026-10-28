import type { FinanceAccount } from "./accounts";
import type { FinanceCategory, InstallmentEntry } from "./installments";
import type { ChargeMethod } from "./summary";

/*
 * As movimentações (2026-10-27, fase 4 da vinda do financeiro da Le Ange, no lugar da aba Pagamentos de lá): todo
 * dinheiro que entrou ou saiu da empresa, seja lançamento avulso, seja baixa de parcela. Transferência e ajuste
 * ficam de fora, porque não são dinheiro da empresa entrando nem saindo: moram no extrato de cada conta.
 */

export type MovementEntry = {
  id: string;
  reference: string;
  kind: "income" | "expense";
  /** Estornada é a avulsa desfeita: fica na lista, riscada, para a história não sumir. */
  status: "confirmed" | "cancelled";
  origin: "manual" | "charge";
  title: string;
  description: string;
  amount: number;
  date: string;
  method: ChargeMethod | null;
  accountId: string;
  categoryId: string | null;
  chargeId: string | null;
  avatarUrl: string | null;
};

export type MovementsScreenData = { movements: MovementEntry[]; accounts: FinanceAccount[]; categories: FinanceCategory[]; today: string };

export type FinanceLookups = { accounts: FinanceAccount[]; categories: FinanceCategory[] };

/** O que o fluxo de caixa lê: as movimentações confirmadas e as parcelas pendentes dos dois lados. */
export type CashFlowData = { movements: MovementEntry[]; dues: InstallmentEntry[]; accounts: FinanceAccount[]; categories: FinanceCategory[]; today: string };
