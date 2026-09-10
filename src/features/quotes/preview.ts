import { previewQuotes, toLatestQuote } from "./list-preview";
import type { QuotesSummary } from "./summary";

/**
 * O resumo do painel enquanto o domínio não existe no banco: o último orçamento da base de exemplo, na
 * versão curta. Quem montar a tabela troca só a origem: o bloco recebe o resumo por prop e não sabe de onde
 * ele vem. Sai da mesma lista da página de orçamentos, para o painel e a lista falarem do mesmo orçamento.
 */
export const previewQuotesSummary: QuotesSummary = {
  latest: toLatestQuote(previewQuotes[0]),
};
