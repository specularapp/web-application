import "server-only";
import { requireOrganization } from "@/features/organizations/context";
import { getQuote, getQuotesSummary } from "./service";
import type { Quote, QuotesSummary } from "./summary";

/**
 * A ficha de um orçamento e o bloco do painel. Separados de `queries.ts` porque lá mora o que a tela inteira
 * precisa, com as duas bases do editor junto, e aqui só o documento: a página do orçamento pede os dois, e
 * misturar faria a ficha carregar a lista de novo.
 */
export async function getQuoteById(id: string, next = "/orcamentos"): Promise<Quote | null> {
  const { supabase, organizationId } = await requireOrganization(next);
  return getQuote(supabase, organizationId, id);
}

export async function getQuotesBlock(next = "/dashboard"): Promise<QuotesSummary> {
  const { supabase, organizationId, user } = await requireOrganization(next);
  return getQuotesSummary(supabase, organizationId, user.id);
}
