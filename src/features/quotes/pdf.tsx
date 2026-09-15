import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { registerInterFonts } from "@/lib/pdf/fonts";
import { QuotePdfDocument } from "./pdf-document";
import { quotePdfImages } from "./pdf-images";
import type { Quote } from "./summary";

/**
 * Onde o PDF do orçamento é gerado. Fica no servidor porque é lá que estão a fonte, o `sharp` e o desenho
 * gerado, e porque assim a rota devolve o arquivo pronto: o cliente clica uma vez e o PDF desce, sem a
 * janela de impressão do navegador no meio. A Inter é registrada por `lib/pdf/fonts.ts`, que o contrato
 * também usa.
 */

/** O orçamento em PDF, a folha inteira: uma chamada, um arquivo. */
export async function renderQuotePdf(quote: Quote) {
  registerInterFonts();
  const images = await quotePdfImages(quote);
  return renderToBuffer(<QuotePdfDocument quote={quote} images={images} />);
}
