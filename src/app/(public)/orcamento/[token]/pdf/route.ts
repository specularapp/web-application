import { findQuoteByToken } from "@/features/quotes/list";
import { previewQuotes } from "@/features/quotes/list-preview";
import { renderQuotePdf } from "@/features/quotes/pdf";
import { quoteDocumentName } from "@/features/quotes/share";

/**
 * O orçamento em PDF, no mesmo endereço público do documento e com a mesma credencial: o token do link.
 * `Content-Disposition: attachment` é o que faz o clique baixar o arquivo em vez de abrir mais uma aba, sem
 * a janela de impressão do navegador no caminho (pedido de 2026-09-09).
 *
 * Serve tanto a página pública quanto o aplicativo: quem tem o token tem o documento, então não há uma
 * segunda porta em `api/v1` para o mesmo arquivo. O desenho vem de `features/quotes/pdf.tsx`, que é a mesma
 * folha da tela.
 *
 * Node, e não borda: a fonte é lida do disco, o `sharp` desenha os rostos e o react-pdf monta o arquivo.
 */
export const runtime = "nodejs";

/* O nome do arquivo tem acento e vírgula, e cabeçalho HTTP é ASCII: o `filename*` leva o nome de verdade em
   UTF-8, que é o que todo navegador atual lê, e o `filename` fica como reserva sem acento para o resto. */
function contentDisposition(name: string) {
  const plain = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/["\\]/g, "")
    .replace(/[^\x20-\x7e]/g, "");
  return `attachment; filename="${plain}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = findQuoteByToken(previewQuotes, token);
  if (!quote) return new Response("Orçamento não encontrado", { status: 404 });

  const file = await renderQuotePdf(quote);

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition(`${quoteDocumentName(quote)}.pdf`),
      "Content-Length": String(file.length),
      /* O documento é do cliente, não do buscador nem do cache da borda, como a página que o mostra. */
      "Cache-Control": "private, no-store",
    },
  });
}
