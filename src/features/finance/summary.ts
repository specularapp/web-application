import { houseDay } from "@/lib/utils/day";

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
 * hoje, então uma parcela que passou do vencimento vira "vencida" sozinha. Cada parcela baixada vira uma
 * movimentação, e é assim que a cobrança e o caixa batem.
 *
 * **A despesa é a mesma peça virada para o outro lado** (2026-09-20, a pedido): mesmo título, mesma
 * contraparte, mesmas parcelas com vencimento, mesma situação, mesma baixa. O que muda é o sinal, e por isso
 * é uma direção aqui e não um segundo modelo: duplicar tudo para inverter um sinal deixaria duas cópias da
 * mesma regra para sair de sincronia no primeiro acerto.
 */

/** `incoming`: a equipe recebe (cobrança). `outgoing`: a equipe paga (despesa). */
export type ChargeDirection = "incoming" | "outgoing";

export const chargeDirectionValues = ["incoming", "outgoing"] as const;

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

/** Com que frequência a cobrança se repete. A próxima nasce quando esta fecha, e não por relógio. */
export type ChargeRecurrence = "none" | "monthly" | "quarterly" | "yearly";

/**
 * A contraparte: quem paga, na cobrança, e quem recebe, na despesa. Nula inteira na **avulsa**: nem tudo
 * que se cobra é de um cliente cadastrado (uma assinatura de sistema, um serviço solto, um rateio), e
 * obrigar a cadastrar alguém só para poder lançar sujaria a base de clientes. Ali quem diz do que se trata
 * é o título, e a foto. Numa despesa ela é quase sempre um nome digitado: fornecedor não é cliente, e não
 * tem por que entrar na base de clientes para uma assinatura ser paga.
 */
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
  /** Para que lado o dinheiro anda: recebida é cobrança, paga é despesa. */
  direction: ChargeDirection;
  title: string;
  description: string;
  /** Nulo na cobrança avulsa, que não é de ninguém da base. */
  client: ChargeClient | null;
  /** A foto do que está sendo cobrado, quando isso tem rosto; aparece também no link do pagador. */
  imageUrl: string | null;
  /** Com que frequência ela se repete; `none` é a de uma vez só. */
  recurrence: ChargeRecurrence;
  owner: { name: string; avatarUrl: string | null };
  /** O total, em centavos: a soma das parcelas. */
  amount: number;
  method: ChargeMethod;
/** Como o pagamento acontece: a chave Pix e os dados da conta. Na cobrança é o que o cliente precisa
   * para pagar, e vai no link e no e-mail; na despesa é para onde a equipe paga, e fica só aqui dentro. */
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

/* Hoje no fuso da casa, e não em UTC: é o mesmo dia que as funções do banco calculam, e é o que faz a
   situação de uma parcela concordar com o rótulo do vencimento entre 21h e a meia-noite (2026-09-22). */
export const todayIso = () => houseDay();

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

/** Quanto já foi liquidado: recebido na cobrança, pago na despesa. */
export const chargeSettled = (charge: Charge) => charge.installments.reduce((sum, installment) => sum + (installment.paidAt ? installment.amount : 0), 0);

export const chargeOpen = (charge: Charge) => (charge.cancelledAt ? 0 : charge.amount - chargeSettled(charge));

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
  /** Nulo na cobrança avulsa, que não é de ninguém da base: ali o título é quem diz do que se trata. */
  clientName: string | null;
  clientAvatarUrl: string | null;
  number: number;
  total: number;
  amount: number;
  dueDate: string;
  overdue: boolean;
  reported: boolean;
  /** De que lado ela está: o que a equipe tem a receber, ou o que ela tem a pagar. */
  direction: ChargeDirection;
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
  /** O que a equipe deve e ainda não pagou: a soma das parcelas em aberto das despesas. */
  payable: number;
  payableCount: number;
  overdue: number;
  overdueCount: number;
  /** Do que a equipe deve, o que já passou do vencimento. */
  payableOverdue: number;
  payableOverdueCount: number;
  months: FinanceMonth[];
  transactions: Transaction[];
  upcoming: UpcomingInstallment[];
  late: UpcomingInstallment[];
};
