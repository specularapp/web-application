import type { Quote, QuoteDiscount, QuoteLine } from "./summary";

export type QuoteTotals = {
  /** A soma das linhas cobradas, em centavos; cortesia não entra. */
  subtotal: number;
  /** Quanto a equipe deu de cortesia, a preço de tabela: entra no documento como valor de brinde. */
  courtesy: number;
  /** Quanto o desconto tira do subtotal, em centavos; zero sem desconto. */
  discount: number;
  total: number;
  /** O valor de cada parcela, em centavos; igual ao total à vista. */
  installment: number;
  /** Quanto o desconto de pagamento à vista tira, em centavos; zero quando não há. */
  cashSaving: number;
  /** O total pagando à vista, já com o desconto de à vista. */
  cash: number;
};

/** Se a linha é brinde: sim e "só hoje" não cobram nada. */
export const isCourtesy = (line: Pick<QuoteLine, "courtesy">) => line.courtesy !== "no";

/** O total de uma linha: quantidade vezes o unitário, em centavos. Cortesia não cobra nada. */
export const lineTotal = (line: Pick<QuoteLine, "quantity" | "unitPrice" | "courtesy">) => (isCourtesy(line) ? 0 : Math.round(line.quantity * line.unitPrice));

/** Quanto a linha valeria se fosse cobrada: é o que o documento mostra riscado numa cortesia. */
export const lineValue = (line: Pick<QuoteLine, "quantity" | "unitPrice">) => Math.round(line.quantity * line.unitPrice);

/** Quanto o desconto tira do subtotal, nunca mais que ele. */
export function discountAmount(subtotal: number, discount: QuoteDiscount) {
  if (!discount || discount.value <= 0) return 0;
  const amount = discount.kind === "percent" ? Math.round((subtotal * discount.value) / 100) : discount.value;
  return Math.min(subtotal, amount);
}

/**
 * Os totais do orçamento, somados uma vez para a tabela, o editor e o documento dizerem o mesmo número.
 * A parcela é o total dividido, arredondado: a diferença de centavos fica para a cobrança acertar. O
 * desconto de à vista não muda o total; ele é uma oferta, e o documento a mostra ao lado das parcelas.
 */
export function quoteTotals(quote: Pick<Quote, "lines" | "discount" | "installments" | "cashDiscount">): QuoteTotals {
  const subtotal = quote.lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const courtesy = quote.lines.reduce((sum, line) => sum + (isCourtesy(line) ? lineValue(line) : 0), 0);
  const discount = discountAmount(subtotal, quote.discount);
  const total = subtotal - discount;
  const installments = Math.max(1, quote.installments);
  const cashSaving = quote.cashDiscount > 0 ? Math.round((total * quote.cashDiscount) / 100) : 0;

  return {
    subtotal,
    courtesy,
    discount,
    total,
    installment: Math.round(total / installments),
    cashSaving,
    cash: total - cashSaving,
  };
}
