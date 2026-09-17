import "server-only";
import { hasResend } from "@/lib/env";
import { siteConfig } from "@/lib/metadata";
import { getFromEmail, getResend } from "./client";

/**
 * O casco dos e-mails da casa (saiu do contrato em 2026-09-15, quando as automações passaram a mandar e-mail
 * com o mesmo desenho): HTML em tabela, uma coluna, a logo em cima, o título, a explicação curta, o botão
 * preto quando há para onde ir, e o endereço por extenso embaixo para quem o botão não funciona. Tudo inline,
 * porque cliente de e-mail não lê folha de estilo.
 */

const escapes: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => escapes[character] ?? character);

export type EmailShell = {
  title: string;
  preview: string;
  heading: string;
  /** Parágrafos já em HTML seguro (quem chama escapa o que veio da pessoa). */
  lines: string[];
  button?: { label: string; url: string };
  footnote: string;
  /** A linha final sobre por que a pessoa recebeu; sem ela vale a do contrato. */
  reason?: string;
};

export function shell({ title, preview, heading, lines, button, footnote, reason }: EmailShell) {
  const paragraphs = lines.map((line) => `<p style="margin: 16px 0 0; font-size: 14px; line-height: 1.7; color: #6e6e73;">${line}</p>`).join("");
  const link = button ? escapeHtml(button.url) : null;
  const action = button && link
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px 0 0;">
                  <tr>
                    <td style="border-radius: 10px; background-color: #000000;">
                      <a href="${link}" target="_blank" style="display: inline-block; padding: 11px 22px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px;">${escapeHtml(button.label)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin: 20px 0 0; font-size: 12px; line-height: 1.7; color: #8e8e93;">Se o botão não funcionar, copie e cole este endereço no navegador<br /><a href="${link}" style="color: #6e6e73; word-break: break-all;">${link}</a></p>`
    : "";

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
                ${action}
                <p style="margin: 24px 0 0; font-size: 13px; line-height: 1.7; color: #8e8e93;">${footnote}</p>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 44px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-top: 1px solid #e5e5ea; padding-top: 16px; font-size: 12px; line-height: 1.7; color: #8e8e93;">Specular, gestão completa para freelancers e agências<br />${reason ?? "Você recebeu este e-mail porque uma equipe informou seu endereço num contrato, se não faz sentido, ignore esta mensagem"}</td>
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

/** Entrega um e-mail pelo Resend. Sem Resend configurado nada sai e a função diz isso, para a tela avisar. */
export async function deliver(to: string, subject: string, html: string) {
  if (!hasResend()) return false;
  try {
    const { error } = await getResend().emails.send({ from: getFromEmail(), to, subject, html });
    if (error) console.error("e-mail falhou:", error.name);
    return !error;
  } catch (error) {
    console.error("e-mail falhou:", error);
    return false;
  }
}
