/** Recebido, pago ou ainda por receber: é o que decide ícone, cor e sinal na lista. */
export type TransactionKind = "income" | "expense" | "scheduled";

/** Onde a movimentação está: confirmada, aguardando ou cancelada. Sem valor, sai do tipo (previsto aguarda, o resto está confirmado). */
export type TransactionStatus = "confirmed" | "pending" | "cancelled";

/** Por onde o dinheiro passou. */
export type PaymentMethod = { type: "pix" | "card" | "boleto" | "transfer"; label: string };

/** Quem aparece na linha: a foto da pessoa (ou o rosto gerado pelo `Avatar`) ou a logo do serviço em `public/brands`. Sem nada, entra o ícone do tipo. */
export type TransactionVisual = { type: "person"; avatarUrl: string | null } | { type: "brand"; name: string };

export type Transaction = {
  id: string;
  /** Identificador curto que a pessoa vê, no padrão de `lib/utils/reference.ts`: "TRX-2026-0142". */
  reference: string;
  kind: TransactionKind;
  status?: TransactionStatus;
  visual?: TransactionVisual;
  /** De quem veio ou para onde foi, como o nome do cliente ou do serviço. */
  title: string;
  /** Do que se trata, em uma frase curta. */
  description: string;
  /** Em centavos, sempre positivo: o sinal sai de `kind`. */
  amount: number;
  /** Data em que aconteceu, ou em que vai acontecer, no formato `yyyy-MM-dd`. */
  date: string;
  /** Hora, no formato `HH:mm`, quando se sabe. */
  time?: string;
  method?: PaymentMethod;
  /** A cobrança de onde a entrada veio, quando veio de uma. */
  chargeId?: string;
};

/** O que o bloco de financeiro do painel mostra: quanto há em caixa e as últimas movimentações. */
export type FinanceSummary = {
  /** Saldo em caixa da equipe, em centavos. */
  balance: number;
  /** Da mais recente para a mais antiga, com o que está por vir no topo. */
  transactions: Transaction[];
};

/** A situação de fato: a declarada, ou a que o tipo implica. */
export function statusOf(transaction: Transaction): TransactionStatus {
  return transaction.status ?? (transaction.kind === "scheduled" ? "pending" : "confirmed");
}

/**
 * As cobranças (2026-09-15): o que a equipe cobra do cliente, em uma ou mais parcelas, cada uma com o
 * vencimento e o registro do pagamento. A situação da cobrança não é gravada: sai das parcelas e da data de
 * hoje, então uma parcela que passou do vencimento vira "vencida" sozinha. Cada parcela paga vira uma
 * entrada nas movimentações, e é assim que a cobrança e o caixa batem.
 */

export type ChargeMethod = PaymentMethod["type"];

export type Installment = {
  id: string;
  /** 1, 2, 3 na ordem do vencimento. */
  number: number;
  /** Em centavos. */
  amount: number;
  /** `yyyy-MM-dd`. */
  dueDate: string;
  /** ISO com hora quando pagou; nula em aberto. */
  paidAt: string | null;
  paidMethod: ChargeMethod | null;
  /** O cliente avisou pelo link que pagou, e a equipe ainda não confirmou. */
  reported: boolean;
  /** A entrada que o pagamento gerou nas movimentações. */
  transactionId: string | null;
};

export type InstallmentStatus = "open" | "overdue" | "paid" | "cancelled";

export type ChargeStatus = "open" | "partial" | "overdue" | "paid" | "cancelled";

export type ChargeClient = {
  /** O cliente da base; nulo quando a cobrança foi para alguém fora dela. */
  id: string | null;
  name: string;
  company?: string;
  email: string | null;
  avatarUrl: string | null;
};

export type ChargeEventKind = "created" | "sent" | "resent" | "viewed" | "reported" | "paid" | "reopened" | "cancelled";

export type ChargeEvent = {
  id: string;
  kind: ChargeEventKind;
  /** Quem fez: a pessoa da equipe, o cliente, ou nulo quando foi o sistema. */
  actor: string | null;
  /** ISO com hora. */
  at: string;
  /** O que mais importa dizer, como qual parcela foi paga. */
  detail: string | null;
};

export type Charge = {
  id: string;
  /** "COB-2026-0031", pelo padrão de `lib/utils/reference.ts`. */
  reference: string;
  title: string;
  description: string;
  client: ChargeClient;
  owner: { name: string; avatarUrl: string | null };
  /** O total, em centavos: a soma das parcelas. */
  amount: number;
  method: ChargeMethod;
  /** O que o cliente precisa para pagar (a chave Pix, os dados da conta), no link e no e-mail. */
  paymentInfo: string;
  installments: Installment[];
  quote: { id: string; number: string } | null;
  contract: { id: string; reference: string } | null;
  project: { id: string; name: string } | null;
  notes: string;
  /** A credencial do link público. */
  token: string;
  createdAt: string;
  sentAt: string | null;
  viewedAt: string | null;
  cancelledAt: string | null;
  events: ChargeEvent[];
};

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function installmentStatusOf(installment: Installment, charge: Pick<Charge, "cancelledAt">, today = todayIso()): InstallmentStatus {
  if (installment.paidAt) return "paid";
  if (charge.cancelledAt) return "cancelled";
  return installment.dueDate < today ? "overdue" : "open";
}

export function chargeStatusOf(charge: Charge, today = todayIso()): ChargeStatus {
  if (charge.cancelledAt) return "cancelled";
  const unpaid = charge.installments.filter((installment) => !installment.paidAt);
  if (unpaid.length === 0) return "paid";
  if (unpaid.some((installment) => installment.dueDate < today)) return "overdue";
  return unpaid.length < charge.installments.length ? "partial" : "open";
}

export const chargeReceived = (charge: Charge) => charge.installments.reduce((sum, installment) => sum + (installment.paidAt ? installment.amount : 0), 0);

export const chargeOpen = (charge: Charge) => (charge.cancelledAt ? 0 : charge.amount - chargeReceived(charge));

/** A parcela que vem agora: a mais antiga ainda não paga. */
export const nextInstallment = (charge: Charge) => [...charge.installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).find((installment) => !installment.paidAt) ?? null;

/** Um mês do gráfico: quanto entrou e quanto saiu, confirmados. */
export type FinanceMonth = { month: string; label: string; income: number; expense: number };

/** Uma parcela por vencer ou vencida, com o que a lista precisa sem carregar a cobrança inteira. */
export type UpcomingInstallment = {
  chargeId: string;
  installmentId: string;
  reference: string;
  title: string;
  clientName: string;
  clientAvatarUrl: string | null;
  number: number;
  total: number;
  amount: number;
  dueDate: string;
  overdue: boolean;
  reported: boolean;
};

export type FinancePeriod = "mes" | "trimestre" | "ano" | "tudo";

/** A visão geral do financeiro: o caixa, os números do período, o gráfico, as movimentações e o que vence. */
export type FinanceOverview = {
  period: FinancePeriod;
  balance: number;
  received: number;
  receivedCount: number;
  expenses: number;
  expensesCount: number;
  receivable: number;
  receivableCount: number;
  overdue: number;
  overdueCount: number;
  months: FinanceMonth[];
  transactions: Transaction[];
  upcoming: UpcomingInstallment[];
  late: UpcomingInstallment[];
};
