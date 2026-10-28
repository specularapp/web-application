import type { Icon } from "@phosphor-icons/react";
import { ArrowUUpLeftIcon, CheckCircleIcon, ClockIcon, WarningCircleIcon, XCircleIcon } from "@phosphor-icons/react/ssr";
import type { BadgeTone } from "@/components/ui/badge";
import type { Database } from "@/types/database";
import type { FinanceAccount } from "./accounts";
import type { ChargeDirection, ChargeMethod } from "./summary";

/*
 * Contas a receber e contas a pagar (2026-10-27, fase 3 da vinda do financeiro da Le Ange): uma linha por
 * parcela, de cobranças de um lado e de despesas do outro. A situação não é gravada, como na cobrança: sai da
 * parcela, da cobrança e de hoje.
 */

export type InstallmentStatus = "open" | "overdue" | "paid" | "cancelled";

export type FinanceCategory = {
  id: string;
  kind: Database["public"]["Enums"]["finance_category_kind"];
  name: string;
  nature: Database["public"]["Enums"]["finance_category_nature"] | null;
  hue: Database["public"]["Enums"]["palette_hue"];
};

export type InstallmentEntry = {
  id: string;
  chargeId: string;
  direction: ChargeDirection;
  number: number;
  count: number;
  amount: number;
  dueDate: string;
  /** O dia em que a parcela foi baixada, `yyyy-MM-dd`. */
  paidOn: string | null;
  paidMethod: ChargeMethod | null;
  /** O cliente avisou pelo link que pagou, e ninguém conferiu ainda. */
  reported: boolean;
  status: InstallmentStatus;
  title: string;
  reference: string;
  party: { name: string; company: string | null; avatarUrl: string | null; standalone: boolean };
  method: ChargeMethod;
  categoryId: string | null;
  /** Onde o dinheiro caiu (paga) ou onde a cobrança combinou que cairia (em aberto). */
  accountId: string | null;
};

export type InstallmentsScreenData = {
  direction: ChargeDirection;
  entries: InstallmentEntry[];
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  today: string;
};

/** As palavras de cada lado, para uma tela só servir a receber e a pagar. */
export const installmentSides = {
  incoming: { page: "Contas a receber", noun: "conta a receber", party: "Cliente", settle: "Receber", settled: "Recebida", settleTitle: "Registrar recebimento", paidLabel: "Recebido" },
  outgoing: { page: "Contas a pagar", noun: "conta a pagar", party: "Fornecedor", settle: "Pagar", settled: "Paga", settleTitle: "Registrar pagamento", paidLabel: "Pago" },
} as const satisfies Record<ChargeDirection, Record<string, string>>;

export const installmentStatuses: Record<InstallmentStatus, { label: Record<ChargeDirection, string>; tone: BadgeTone; icon: Icon }> = {
  open: { label: { incoming: "Em aberto", outgoing: "Em aberto" }, tone: "info", icon: ClockIcon },
  overdue: { label: { incoming: "Atrasada", outgoing: "Atrasada" }, tone: "danger", icon: WarningCircleIcon },
  paid: { label: { incoming: "Recebida", outgoing: "Paga" }, tone: "success", icon: CheckCircleIcon },
  cancelled: { label: { incoming: "Cancelada", outgoing: "Cancelada" }, tone: "neutral", icon: XCircleIcon },
};

export const reopenIcon = ArrowUUpLeftIcon;

/** "Parcela 2 de 3", ou nada quando a cobrança é de uma vez só. */
export const installmentLabelOf = (entry: Pick<InstallmentEntry, "number" | "count">) => (entry.count > 1 ? `Parcela ${entry.number} de ${entry.count}` : "Parcela única");

export const isPending = (status: InstallmentStatus) => status === "open" || status === "overdue";
