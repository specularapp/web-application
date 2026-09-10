import "server-only";
import { previewCatalog } from "@/features/catalog/list-preview";
import { previewClientsList } from "@/features/clients/list-preview";
import { getCurrentTeamState } from "@/features/organizations/queries";
import { formatReference } from "@/lib/utils/reference";
import { previewIssuer, previewQuotes } from "./list-preview";
import type { Quote, QuoteIssuer, QuotePerson } from "./summary";

export type QuotesScreenData = {
  quotes: Quote[];
  issuer: QuoteIssuer;
  owner: QuotePerson;
  nextNumber: string;
  clients: typeof previewClientsList;
  catalog: typeof previewCatalog;
};

/**
 * O que a tela de orçamentos precisa além da página da lista: quem emite (a equipe em vigor, com o nome e a
 * logo do banco e os contatos da prévia enquanto o time não os tem), quem responde (a pessoa logada), o
 * próximo número da sequência do ano, e os clientes e itens do catálogo que o editor oferece. Os orçamentos
 * da prévia ganham a equipe de verdade como emissora, para o documento sair com a logo certa.
 *
 * Hoje lê da prévia porque **o domínio não existe no banco**; com a tabela, a lista e o próximo número
 * vêm de `service.ts`, e a assinatura continua.
 */
export async function loadQuotesScreenData(next = "/orcamentos"): Promise<QuotesScreenData> {
  const state = await getCurrentTeamState(next);

  const issuer: QuoteIssuer = {
    ...previewIssuer,
    name: state.team?.name ?? previewIssuer.name,
    logoUrl: state.team?.logoUrl ?? null,
    website: state.team?.website ?? previewIssuer.website,
  };
  const owner: QuotePerson = { name: state.viewer.name ?? state.viewer.email ?? "Você", avatarUrl: state.viewer.avatarUrl };

  const quotes = previewQuotes.map((quote) => ({ ...quote, issuer }));
  const year = new Date().getFullYear();
  const sequence = quotes.reduce((max, quote) => Math.max(max, Number(quote.number.slice(-4)) || 0), 0) + 1;

  return {
    quotes,
    issuer,
    owner,
    nextNumber: formatReference("quote", year, sequence),
    // Do mais novo para o mais antigo: o editor mostra os dez primeiros e o resto chega pela busca do painel
    // (pedido de 2026-09-09), então a ordem aqui é o que decide quais são "os últimos cadastrados".
    clients: previewClientsList.filter((client) => client.active).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    catalog: previewCatalog.filter((item) => item.active).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}
