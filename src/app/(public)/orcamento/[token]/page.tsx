import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { QuotePublicView } from "@/features/quotes/components/quote-public-view";
import { findQuoteByToken } from "@/features/quotes/list";
import { previewQuotes } from "@/features/quotes/list-preview";
import { quoteTotals } from "@/features/quotes/totals";
import { createMetadata } from "@/lib/metadata";
import { formatMoney } from "@/lib/utils/format";

type Params = { token: string };

/**
 * O que o WhatsApp mostra ao desdobrar o link: o título é o número e o nome do orçamento, a descrição diz
 * quem preparou, para quem, o total e até quando vale, e a imagem vem de `opengraph-image.tsx` ao lado, no
 * mesmo desenho do documento. `noIndex`, porque a página é do cliente, não do buscador. Link inválido não
 * inventa metadados: cai no 404 como a página.
 */
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { token } = await params;
  const quote = findQuoteByToken(previewQuotes, token);
  if (!quote) return createMetadata({ title: "Orçamento", description: "Este orçamento não está mais disponível.", noIndex: true });

  const { total } = quoteTotals(quote);
  const validity = quote.validUntil ? ` Válido até ${format(parseISO(quote.validUntil), "d 'de' MMMM", { locale: ptBR })}.` : "";
  return createMetadata({
    title: `${quote.number}: ${quote.title}`,
    description: `${quote.issuer.name} preparou este orçamento de ${formatMoney(total)} para ${quote.client.company ?? quote.client.name}.${validity}`,
    path: `/orcamento/${token}`,
    noIndex: true,
    absoluteTitle: true,
  });
}

// A página pública do orçamento, a que o cliente abre pelo link: só por token, que é a credencial, e com o
// documento vindo da mesma base que a lista. Hoje lê da prévia porque **o domínio não existe no banco**;
// com a tabela, a leitura por token entra em `service.ts`, marca a visualização e a assinatura continua.
export default async function PublicQuotePage({ params }: { params: Promise<Params> }) {
  const { token } = await params;
  const quote = findQuoteByToken(previewQuotes, token);
  if (!quote) notFound();

  return <QuotePublicView quote={quote} />;
}
