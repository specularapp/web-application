/** Onde o orçamento está: é o que decide a etiqueta ao lado do título. */
export type QuoteStatus = "draft" | "sent" | "viewed" | "approved" | "declined" | "expired";

export type QuotePerson = { name: string; avatarUrl: string | null };

export type LatestQuote = {
  id: string;
  /** Identificador curto que a pessoa vê e fala, no padrão de `lib/utils/reference.ts`: "ORC-2026-0042". */
  number: string;
  title: string;
  client: QuotePerson;
  /** Quem da equipe montou e responde pelo orçamento. */
  owner: QuotePerson;
  /** Em centavos. */
  amount: number;
  /** Em quantas parcelas; 1 é à vista. */
  installments: number;
  /** Quantos itens o orçamento lista. */
  items: number;
  status: QuoteStatus;
  /** Quando foi enviado ao cliente, no formato `yyyy-MM-dd`; nulo enquanto é rascunho. */
  sentAt: string | null;
  /** Até quando vale, no formato `yyyy-MM-dd`. */
  validUntil: string | null;
  description: string;
};

/** O que o bloco de último orçamento do painel mostra: o último que a pessoa criou, ou nada. */
export type QuotesSummary = {
  latest: LatestQuote | null;
};
