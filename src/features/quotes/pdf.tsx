import "server-only";
import path from "node:path";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { QuotePdfDocument } from "./pdf-document";
import { quotePdfImages } from "./pdf-images";
import type { Quote } from "./summary";

/**
 * Onde o PDF do orçamento é gerado. Fica no servidor porque é lá que estão a fonte, o `sharp` e o desenho
 * gerado, e porque assim a rota devolve o arquivo pronto: o cliente clica uma vez e o PDF desce, sem a
 * janela de impressão do navegador no meio.
 */

/* A Inter em arquivo, os três pesos que o documento usa. Ela mora em `public/fonts/inter` e não vem da
   `next/font`: o `next/font` entrega CSS e um arquivo com nome embaralhado pelo build, e o react-pdf precisa
   do arquivo em si. Vindo da pasta, o PDF é gerado sem tocar a rede, e o `next.config.ts` inclui a pasta no
   rastreamento da rota para ela existir também no servidor de produção. */
const fontDir = path.join(process.cwd(), "public", "fonts", "inter");

/* A Sacramento, a letra da assinatura escrita, pelo mesmo caminho e pelo mesmo motivo: um peso só, porque
   assinatura não tem variação de peso. */
const signatureDir = path.join(process.cwd(), "public", "fonts", "sacramento");

let registered = false;

function registerFonts() {
  if (registered) return;
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(fontDir, "Inter-Regular.ttf"), fontWeight: 400 },
      { src: path.join(fontDir, "Inter-Medium.ttf"), fontWeight: 500 },
      { src: path.join(fontDir, "Inter-SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  Font.register({ family: "Sacramento", fonts: [{ src: path.join(signatureDir, "Sacramento-Regular.ttf"), fontWeight: 400 }] });
  /* Sem hifenização: o react-pdf quebra palavra com hífen por padrão, e em português isso corta nome de
     cliente e de item no meio, o que a folha na tela nunca faz. */
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

/** O orçamento em PDF, a folha inteira: uma chamada, um arquivo. */
export async function renderQuotePdf(quote: Quote) {
  registerFonts();
  const images = await quotePdfImages(quote);
  return renderToBuffer(<QuotePdfDocument quote={quote} images={images} />);
}
