import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { QuoteSignatureStyle } from "./summary";

/**
 * O que a assinatura do documento diz, num lugar só: a tela e o PDF desenham a mesma peça, e a data escrita
 * neles precisa ser a mesma frase, senão a folha e o arquivo divergem no fato mais delicado do documento.
 */

/** Sem escolha registrada, a assinatura é a escrita: é a que lê como assinatura de verdade. */
export const DEFAULT_SIGNATURE_STYLE: QuoteSignatureStyle = "written";

/**
 * A data do registro, como num comprovante. **Com a hora quando ela existe, e sem inventá-la quando não**:
 * o envio hoje é guardado só no dia (`yyyy-MM-dd`), e escrever "às 00:00:00" num registro de assinatura é
 * dizer uma hora que ninguém mediu, o que num documento assinado é pior que não dizer nada. Quando o envio
 * passar a guardar o instante, a marca ganha a hora sozinha, porque a diferença é o formato do que chega.
 */
export function signatureStamp(iso: string) {
  const hasTime = iso.includes("T");
  return format(parseISO(iso), hasTime ? "dd/MM/yyyy 'às' HH:mm:ss" : "dd/MM/yyyy", { locale: ptBR });
}
