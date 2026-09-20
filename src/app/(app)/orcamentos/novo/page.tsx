import { getAiUsageData } from "@/features/ai/queries";
import { QuoteEditorScreen } from "@/features/quotes/components/quote-editor-screen";
import { loadQuoteEditorData } from "@/features/quotes/queries";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Novo orçamento",
  description: "Monte um orçamento personalizado e envie ao cliente",
  path: "/orcamentos/novo",
  noIndex: true,
});

/**
 * O editor de um orçamento novo, em tela inteira (2026-09-16, a pedido, na moldura do editor de contrato).
 * Era a lista com a janela aberta por cima; montar um orçamento é trabalho de tela, e a lista atrás só
 * disputava altura. `?item=` e `?cliente=` chegam do catálogo e da base de clientes e entram preenchidos.
 */
export default async function NewQuotePage({ searchParams }: PageProps<"/orcamentos/novo">) {
  const params = await searchParams;
  const prefill = { itemId: first(params.item) || undefined, clientId: first(params.cliente) || undefined };

  const [data, ai] = await Promise.all([loadQuoteEditorData("/orcamentos/novo"), getAiUsageData()]);

  return (
    <QuoteEditorScreen
      clients={data.clients}
      catalog={data.catalog}
      issuer={data.issuer}
      owner={data.owner}
      nextNumber={data.nextNumber}
      prefill={prefill}
      ai={ai}
    />
  );
}
