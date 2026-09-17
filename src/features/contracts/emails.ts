import "server-only";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { deliver, escapeHtml, shell } from "@/lib/resend/template";

/**
 * Os e-mails do contrato, no casco da casa (`lib/resend/template.ts`, o mesmo do convite de time e das
 * automações): HTML em tabela, uma coluna, a logo em cima, o título, a explicação curta, o botão preto e o
 * endereço por extenso embaixo, para quem o botão não funciona. Dois e-mails: o **convite de assinatura**, um para cada parte com o link dela, e a **cópia
 * assinada**, para as duas quando a última assina. Sem Resend configurado nada sai e a função diz isso, para
 * a tela avisar que o registro ficou e o e-mail não foi.
 */

export type InviteEmail = {
  to: string;
  name: string;
  title: string;
  reference: string;
  issuerName: string;
  /** Quem pediu a assinatura, para o convite dizer de quem vem. */
  senderName: string;
  url: string;
  /** `yyyy-MM-dd`; nulo sem prazo. */
  expiresAt: string | null;
  /** Reenvio: o assunto e a primeira linha dizem que é um lembrete. */
  reminder?: boolean;
};

/** O convite de assinatura de uma parte, com o link dela. Falha de entrega não derruba o envio: o registro fica e dá para reenviar. */
export async function sendSignatureInviteEmail(input: InviteEmail) {
  const firstName = input.name.split(" ")[0] ?? input.name;
  const until = input.expiresAt ? ` O link vale até ${format(parseISO(input.expiresAt), "d 'de' MMMM", { locale: ptBR })}.` : "";
  const subject = input.reminder ? `Lembrete: contrato ${input.reference} aguarda sua assinatura` : `Contrato ${input.reference} para sua assinatura`;

  return deliver(
    input.to,
    subject,
    shell({
      title: subject,
      preview: `${input.senderName} enviou o contrato "${input.title}" para você assinar`,
      heading: `Olá, ${escapeHtml(firstName)}`,
      lines: [
        input.reminder ? `Este é um lembrete: o contrato <strong style="color: #000000; font-weight: 600;">${escapeHtml(input.title)}</strong> ainda aguarda a sua assinatura.` : `${escapeHtml(input.senderName)}, da ${escapeHtml(input.issuerName)}, enviou o contrato <strong style="color: #000000; font-weight: 600;">${escapeHtml(input.title)}</strong> para você revisar e assinar.`,
        `Abra o documento pelo botão abaixo, leia com calma e assine eletronicamente ao final da página. A assinatura fica registrada com data e hora.${escapeHtml(until)}`,
      ],
      button: { label: "Revisar e assinar", url: input.url },
      footnote: "Este link é pessoal e vale só para a sua assinatura. Não o repasse a outras pessoas.",
    }),
  );
}

export type SignedCopyEmail = {
  to: string;
  name: string;
  title: string;
  reference: string;
  issuerName: string;
  url: string;
};

/** A cópia assinada, para as duas partes, quando a última assina: o link abre o documento com as assinaturas e o PDF para baixar. */
export async function sendSignedCopyEmail(input: SignedCopyEmail) {
  const firstName = input.name.split(" ")[0] ?? input.name;
  const subject = `Contrato ${input.reference} assinado por todas as partes`;

  return deliver(
    input.to,
    subject,
    shell({
      title: subject,
      preview: `O contrato "${input.title}" foi assinado por todas as partes`,
      heading: `Tudo assinado, ${escapeHtml(firstName)}`,
      lines: [
        `O contrato <strong style="color: #000000; font-weight: 600;">${escapeHtml(input.title)}</strong>, entre você e a ${escapeHtml(input.issuerName)}, foi assinado por todas as partes.`,
        "Guarde a sua cópia: o documento com as assinaturas e o registro de data e hora fica disponível no endereço abaixo, com o PDF para baixar.",
      ],
      button: { label: "Abrir o contrato assinado", url: input.url },
      footnote: "Este link é pessoal. O documento continua disponível nele para consulta.",
    }),
  );
}
