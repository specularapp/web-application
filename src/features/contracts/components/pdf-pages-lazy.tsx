"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/spinner";
import type { PdfPagesProps } from "./pdf-pages";

/**
 * O desenhador de PDF, carregado só quando uma tela de fato mostra um contrato anexado.
 *
 * O `pdfjs-dist` passa de trezentos kilobytes, e a peça é usada na janela do contrato, no editor de campos e
 * na página pública de assinar. Importado direto, ele entrava no pacote da **listagem** de contratos, que
 * abre com cartões e nenhum PDF à vista: toda visita a `/contratos` baixava o leitor de PDF sem precisar.
 *
 * `ssr: false` porque o pdf.js mexe em APIs de tela que não existem no servidor, e o componente de verdade
 * já carrega o motor por importação dinâmica pelo mesmo motivo.
 */
export const PdfPages = dynamic<PdfPagesProps>(() => import("./pdf-pages").then((module) => module.PdfPages), {
  ssr: false,
  loading: () => <Spinner label="Carregando o documento" />,
});

export type { PdfPageSize, PdfPagesProps } from "./pdf-pages";
