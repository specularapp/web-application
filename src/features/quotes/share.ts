import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { formatMoney } from "@/lib/utils/format";
import { siteConfig } from "@/lib/metadata";
import type { Quote } from "./summary";
import { quoteTotals } from "./totals";

/** O endereço público do orçamento, o que o cliente recebe: absoluto, para colar em qualquer lugar. */
export function quoteShareUrl(token: string) {
  return `${siteConfig.url}/orcamento/${token}`;
}

/**
 * O nome do documento salvo, o que o cliente vê na pasta de downloads dele (2026-09-09, a pedido): o número
 * e para quem é, e nada além disso. Vale para o arquivo que a rota do PDF entrega e para o título da página
 * durante a impressão do navegador, que é de onde o nome do PDF sai lá.
 */
export function quoteDocumentName(quote: Quote) {
  return `Orçamento ${quote.number}, ${quote.client.company ?? quote.client.name}`;
}

/* Os sinais diacríticos que o `NFD` separa da letra: tirá-los deixa "Orçamento" em "Orcamento". */
const DIACRITICS = /[\u0300-\u036f]/g;

/**
 * O mesmo nome, mas seguro para virar **anexo** no celular (2026-09-10, do relato de que o WhatsApp do
 * iPhone recusava o arquivo com "Não foi possível enviar a mensagem"): sem acento, sem vírgula e com um
 * sublinhado no lugar do espaço.
 *
 * A folha de compartilhar do iOS monta a prévia a partir do arquivo, e quando ela não aparece o destino
 * recebe um anexo degradado: salvar em Arquivos ainda funciona, porque só precisa dos bytes, mas o WhatsApp
 * falha. O nome bonito, com acento e vírgula, continua valendo onde ele é lido como texto: o
 * `Content-Disposition` da rota, que é o que nomeia o arquivo baixado no computador.
 */
export function quoteAttachmentName(quote: Quote) {
  return `${quoteDocumentName(quote)}.pdf`
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_");
}

/**
 * A mensagem que vai para o cliente no WhatsApp, escrita na formatação de lá (2026-09-09, a pedido): o
 * negrito entre asteriscos e o itálico entre sublinhados, linhas curtas e um bloco por assunto, com uma
 * linha vazia entre eles, que é como o WhatsApp respira. Sem emoji, no tom da casa.
 *
 * A ordem é a que a pessoa lê no celular: quem fala e por quê, o que é o orçamento, quanto custa e como
 * pagar, e o link sozinho na última linha, que é o que faz o WhatsApp desdobrar a prévia com a imagem do
 * documento.
 */
export function quoteWhatsappMessage(quote: Quote) {
  const { total, installment, cash } = quoteTotals(quote);
  const firstName = quote.client.name.split(" ")[0];
  const lines = [
    `Olá, ${firstName}! Segue o orçamento que a ${quote.issuer.name} preparou.`,
    "",
    `*${quote.title}*`,
    `Orçamento ${quote.number}`,
    "",
    `*Total* ${formatMoney(total)}`,
  ];

  if (quote.installments > 1) lines.push(`Em ${quote.installments}x de ${formatMoney(installment)}`);
  if (quote.cashDiscount > 0) lines.push(`À vista com ${quote.cashDiscount}% de desconto, ${formatMoney(cash)}`);
  if (quote.validUntil) lines.push(`_Válido até ${format(parseISO(quote.validUntil), "d 'de' MMMM", { locale: ptBR })}_`);

  lines.push("", "Veja os itens e aprove por aqui:", quoteShareUrl(quote.shareToken));
  return lines.join("\n");
}

/**
 * O link que abre o WhatsApp com a mensagem pronta, no número do cliente quando há. O WhatsApp desdobra o
 * endereço do documento na prévia com a imagem do orçamento.
 */
export function quoteWhatsappUrl(quote: Quote) {
  const phone = quote.client.phone ? `55${quote.client.phone}` : "";
  return `https://wa.me/${phone}?text=${encodeURIComponent(quoteWhatsappMessage(quote))}`;
}
