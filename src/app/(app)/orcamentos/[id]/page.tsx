import { notFound } from "next/navigation";
import { getAiUsageData } from "@/features/ai/queries";
import { QuoteEditorScreen } from "@/features/quotes/components/quote-editor-screen";
import { getQuoteById } from "@/features/quotes/detail";
import { loadQuoteEditorData } from "@/features/quotes/queries";
import { createMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }: PageProps<"/orcamentos/[id]">) {
  const { id } = await params;
  const quote = await getQuoteById(id);

  return createMetadata({
    title: quote ? `Orçamento ${quote.number}` : "Orçamento",
    description: "Editor do orçamento, com os itens, o pagamento e a prévia do documento",
    path: `/orcamentos/${id}`,
    noIndex: true,
  });
}

/**
 * O editor de um orçamento, em tela inteira: ele tem endereço próprio, então dá para mandar o link para a
 * equipe e abrir direto. Orçamento inexistente cai em 404.
 */
export default async function QuotePage({ params }: PageProps<"/orcamentos/[id]">) {
  const { id } = await params;

  const [quote, data, ai] = await Promise.all([getQuoteById(id), loadQuoteEditorData(`/orcamentos/${id}`), getAiUsageData()]);
  if (!quote) notFound();

  return (
    <QuoteEditorScreen
      quote={quote}
      clients={data.clients}
      catalog={data.catalog}
      issuer={data.issuer}
      owner={data.owner}
      nextNumber={data.nextNumber}
      ai={ai}
    />
  );
}
