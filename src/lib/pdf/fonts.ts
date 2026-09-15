import "server-only";
import path from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * A Inter em arquivo para o react-pdf, os três pesos que os documentos da casa usam (o orçamento e o
 * contrato). Ela mora em `public/fonts/inter` e não vem da `next/font`: o `next/font` entrega CSS e um
 * arquivo com nome embaralhado pelo build, e o react-pdf precisa do arquivo em si. Vindo da pasta, o PDF é
 * gerado sem tocar a rede, e o `next.config.ts` inclui a pasta no rastreamento das rotas de PDF para ela
 * existir também no servidor de produção. Registrar é uma vez por processo.
 */
const fontDir = path.join(process.cwd(), "public", "fonts", "inter");

let registered = false;

export function registerInterFonts() {
  if (registered) return;
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(fontDir, "Inter-Regular.ttf"), fontWeight: 400 },
      { src: path.join(fontDir, "Inter-Medium.ttf"), fontWeight: 500 },
      { src: path.join(fontDir, "Inter-SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  /* Sem hifenização: o react-pdf quebra palavra com hífen por padrão, e em português isso corta nome de
     cliente e de item no meio, o que a folha na tela nunca faz. */
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
