/** Recebido, pago ou ainda por receber: é o que decide ícone, cor e sinal na lista. */
export type TransactionKind = "income" | "expense" | "scheduled";

/** Quem aparece na linha: a foto da pessoa (ou o rosto gerado pelo `Avatar`) ou a logo do serviço em `public/brands`. Sem nada, entra o ícone do tipo. */
export type TransactionVisual = { type: "person"; avatarUrl: string | null } | { type: "brand"; name: string };

export type Transaction = {
  id: string;
  kind: TransactionKind;
  visual?: TransactionVisual;
  /** De quem veio ou para onde foi, como o nome do cliente ou do serviço. */
  title: string;
  /** Do que se trata, em uma frase curta. */
  description: string;
  /** Em centavos, sempre positivo: o sinal sai de `kind`. */
  amount: number;
  /** Data em que aconteceu, ou em que vai acontecer, no formato `yyyy-MM-dd`. */
  date: string;
};

/** O que o bloco de financeiro do painel mostra: quanto há em caixa e as últimas movimentações. */
export type FinanceSummary = {
  /** Saldo em caixa da equipe, em centavos. */
  balance: number;
  /** Da mais recente para a mais antiga, com o que está por vir no topo. */
  transactions: Transaction[];
};
