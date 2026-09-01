import "server-only";
import { hasResend } from "@/lib/env";
import { siteConfig } from "@/lib/metadata";
import { getFromEmail, getResend } from "@/lib/resend/client";

type InviteEmail = {
  to: string;
  name: string;
  teamName: string;
  inviterName: string | null;
  url: string;
};

const escapes: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => escapes[character] ?? character);
}

function inviteHtml({ name, teamName, inviterName, url }: InviteEmail) {
  const team = escapeHtml(teamName);
  const invitedBy = inviterName ? `${escapeHtml(inviterName)} convidou você` : "Você foi convidado";
  const link = escapeHtml(url);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>Convite para o time ${team}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #ffffff;">
    <div style="display: none; max-height: 0; overflow: hidden;">${invitedBy} para o time ${team}</div>
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
                <h1 style="margin: 0; font-size: 21px; line-height: 1.35; font-weight: 600; letter-spacing: -0.3px; color: #000000;">Olá, ${escapeHtml(name)}</h1>
                <p style="margin: 16px 0 0; font-size: 14px; line-height: 1.7; color: #6e6e73;">${invitedBy} para trabalhar junto no time ${team} dentro do Specular</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px 0 0;">
                  <tr>
                    <td style="border-radius: 10px; background-color: #000000;">
                      <a href="${link}" target="_blank" style="display: inline-block; padding: 11px 22px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px;">Aceitar convite</a>
                    </td>
                  </tr>
                </table>
                <p style="margin: 20px 0 0; font-size: 12px; line-height: 1.7; color: #8e8e93;">Se o botão não funcionar, copie e cole este endereço no navegador<br /><a href="${link}" style="color: #6e6e73; word-break: break-all;">${link}</a></p>
                <p style="margin: 24px 0 0; font-size: 13px; line-height: 1.7; color: #8e8e93;">O convite vale por 7 dias e precisa ser aceito com este mesmo e-mail</p>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 44px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-top: 1px solid #e5e5ea; padding-top: 16px; font-size: 12px; line-height: 1.7; color: #8e8e93;">Specular, gestão completa para freelancers e agências<br />Você recebeu este e-mail porque alguém do time informou seu endereço, se não faz sentido, ignore esta mensagem</td>
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

// O convite já está registrado quando o e-mail sai, então falha de entrega não derruba a ação:
// a pessoa continua na lista como pendente e o convite pode ser reenviado.
export async function sendInviteEmail(input: InviteEmail) {
  if (!hasResend()) return false;

  try {
    const { error } = await getResend().emails.send({
      from: getFromEmail(),
      to: input.to,
      subject: `Convite para o time ${input.teamName} no Specular`,
      html: inviteHtml(input),
    });
    if (error) console.error("convite por e-mail falhou:", error.name);
    return !error;
  } catch (error) {
    console.error("convite por e-mail falhou:", error);
    return false;
  }
}
