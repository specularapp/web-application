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
