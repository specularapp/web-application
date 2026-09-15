import "server-only";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { hasResend } from "@/lib/env";
import { siteConfig } from "@/lib/metadata";
import { getFromEmail, getResend } from "@/lib/resend/client";

/**
 * Os e-mails do contrato, no mesmo desenho do convite de time: HTML em tabela, uma coluna, a logo em cima,
 * o título, a explicação curta, o botão preto e o endereço por extenso embaixo, para quem o botão não
 * funciona. Dois e-mails: o **convite de assinatura**, um para cada parte com o link dela, e a **cópia
 * assinada**, para as duas quando a última assina. Sem Resend configurado nada sai e a função diz isso, para
 * a tela avisar que o registro ficou e o e-mail não foi.
 */

const escapes: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => escapes[character] ?? character);

type Shell = { title: string; preview: string; heading: string; lines: string[]; button: { label: string; url: string }; footnote: string };

function shell({ title, preview, heading, lines, button, footnote }: Shell) {
  const link = escapeHtml(button.url);
  const paragraphs = lines.map((line) => `<p style="margin: 16px 0 0; font-size: 14px; line-height: 1.7; color: #6e6e73;">${line}</p>`).join("");

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #ffffff;">
    <div style="display: none; max-height: 0; overflow: hidden;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff;">
      <tr>
        <td align="center" style="padding: 48px 24px 40px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%;">
            <tr>
              <td style="padding-bottom: 36px;">
                <img src="${siteConfig.url}/logotipo/specular-icon-email.png" alt="Specular" width="40" height="40" style="display: block; width: 40px; height: 40px; border: 0;" />
              </td>
            </tr>
            <tr>
              <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                <h1 style="margin: 0; font-size: 21px; line-height: 1.35; font-weight: 600; letter-spacing: -0.3px; color: #000000;">${heading}</h1>
                ${paragraphs}
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px 0 0;">
                  <tr>
                    <td style="border-radius: 10px; background-color: #000000;">
                      <a href="${link}" target="_blank" style="display: inline-block; padding: 11px 22px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px;">${escapeHtml(button.label)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin: 20px 0 0; font-size: 12px; line-height: 1.7; color: #8e8e93;">Se o botão não funcionar, copie e cole este endereço no navegador<br /><a href="${link}" style="color: #6e6e73; word-break: break-all;">${link}</a></p>
                <p style="margin: 24px 0 0; font-size: 13px; line-height: 1.7; color: #8e8e93;">${footnote}</p>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 44px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-top: 1px solid #e5e5ea; padding-top: 16px; font-size: 12px; line-height: 1.7; color: #8e8e93;">Specular, gestão completa para freelancers e agências<br />Você recebeu este e-mail porque uma equipe informou seu endereço num contrato, se não faz sentido, ignore esta mensagem</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function deliver(to: string, subject: string, html: string) {
  if (!hasResend()) return false;
  try {
    const { error } = await getResend().emails.send({ from: getFromEmail(), to, subject, html });
    if (error) console.error("e-mail do contrato falhou:", error.name);
    return !error;
  } catch (error) {
    console.error("e-mail do contrato falhou:", error);
    return false;
  }
}

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
