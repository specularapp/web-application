import type { CatalogUnit } from "@/features/catalog/summary";

/** Onde o orçamento está: é o que decide a etiqueta ao lado do título. */
export type QuoteStatus = "draft" | "sent" | "viewed" | "approved" | "declined" | "expired";

/**
 * Como a assinatura de quem responde pelo orçamento é desenhada no documento (2026-09-10, a pedido):
 * `written` escreve o nome à mão, na Sacramento, e `digital` mostra a foto da pessoa com o registro do
 * documento assinado, sem letra nenhuma. É preferência de quem assina, então vive na pessoa e não no
 * orçamento; **a tela que a escolhe entra depois**, e por ora o valor é fixo para ver o desenho.
 */
export type QuoteSignatureStyle = "written" | "digital";

export type QuotePerson = { name: string; avatarUrl: string | null; signatureStyle?: QuoteSignatureStyle };

/** Como o cliente paga, escrito no documento junto das parcelas. */
export type QuotePaymentMethod = "pix" | "transfer" | "boleto" | "card";

/** Se a linha é cortesia: não, sim, ou só se o cliente fechar hoje (2026-09-09, a pedido). */
export type QuoteCourtesy = "no" | "yes" | "today";

/** Uma linha do orçamento: um item do catálogo ou um item avulso, com quantidade e preço unitário em centavos. */
export type QuoteLine = {
  id: string;
  /** O item do catálogo de onde a linha veio; nulo quando foi escrita à mão. */
  catalogItemId: string | null;
  name: string;
  /** O que a linha entrega, em uma frase; opcional. */
  description: string;
  quantity: number;
  /** Em centavos. */
  unitPrice: number;
  unit: CatalogUnit;
  /** Brinde: entra no documento com a etiqueta e não soma no total. "today" é cortesia só se fechar hoje. */
  courtesy: QuoteCourtesy;
};

/** Desconto sobre o subtotal: em pontos percentuais ou em centavos. Nulo é sem desconto. */
export type QuoteDiscount = { kind: "percent" | "amount"; value: number } | null;

/** Para quem o orçamento vai: a pessoa e, quando há, a empresa e os contatos que o documento imprime. */
export type QuoteClient = QuotePerson & {
  company?: string;
  email?: string;
  phone?: string;
  city?: string;
};

/** Quem emite: a equipe, com a logo e os contatos que assinam o documento. */
export type QuoteIssuer = {
  name: string;
  logoUrl: string | null;
  website?: string;
  email?: string;
  phone?: string;
  city?: string;
};

/** O orçamento inteiro, como a ficha, o editor e o documento público o leem. */
export type Quote = {
  id: string;
  /** Identificador curto que a pessoa vê e fala, no padrão de `lib/utils/reference.ts`: "ORC-2026-0042". */
  number: string;
  title: string;
  status: QuoteStatus;
  /** O cliente da base; nulo quando o orçamento foi para alguém fora dela. */
  clientId: string | null;
  client: QuoteClient;
  /** Quem da equipe montou e responde pelo orçamento. */
  owner: QuotePerson;
  issuer: QuoteIssuer;
  lines: QuoteLine[];
  discount: QuoteDiscount;
  /** Em quantas parcelas; 1 é à vista. */
  installments: number;
  /** As formas que a equipe aceita neste orçamento; ao menos uma (2026-09-09, a pedido: eram uma só). */
  paymentMethods: QuotePaymentMethod[];
  /** Desconto oferecido para pagamento à vista, em pontos percentuais; zero quando não há. */
  cashDiscount: number;
  /** Observações para o cliente, em texto corrido. */
  notes: string;
  /** Datas no formato `yyyy-MM-dd`. */
  issuedAt: string;
  validUntil: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  /** Quando o cliente aprovou ou recusou. */
  respondedAt: string | null;
  /** O token do link público, aleatório e longo: é ele que o cliente recebe no WhatsApp. */
  shareToken: string;
  createdAt: string;
  updatedAt: string;
};

/** O bloco do painel e a ficha do cliente leem esta versão curta, com os totais já somados. */
export type LatestQuote = {
  id: string;
  number: string;
  title: string;
  client: QuotePerson;
  owner: QuotePerson;
  /** Em centavos, já com o desconto. */
  amount: number;
  installments: number;
  /** Quantas linhas o orçamento lista. */
  items: number;
  status: QuoteStatus;
  sentAt: string | null;
  validUntil: string | null;
  description: string;
};

/** O que o bloco de último orçamento do painel mostra: o último que a pessoa criou, ou nada. */
export type QuotesSummary = {
  latest: LatestQuote | null;
};
