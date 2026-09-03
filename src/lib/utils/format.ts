const plain = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const short = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const long = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

/**
 * Dinheiro encurtado para caber em espaço apertado: R$ 950, R$ 30,5k, R$ 1,243M. Dinheiro entra em
 * centavos, como em todo lugar do produto. Valor por extenso continua em `formatMoney`.
 */
export function compactMoney(cents: number) {
  const value = Math.round(cents / 100);
  const size = Math.abs(value);

  if (size < 1000) return `R$ ${plain.format(value)}`;
  if (size < 1_000_000) return `R$ ${short.format(value / 1000)}k`;
  return `R$ ${long.format(value / 1_000_000)}M`;
}
