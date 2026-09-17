import "server-only";
import { hasResend } from "@/lib/env";
import { deliver, escapeHtml, shell } from "@/lib/resend/template";

/**
 * O e-mail que uma automação manda: o texto que a pessoa escreveu no nó, já com as variáveis resolvidas, no
 * casco da casa. Cada linha vira um parágrafo; uma linha que é só um endereço vira o botão, com o nome pelo
 * que o endereço abre. Sem Resend configurado nada sai, e a função diz isso para o registro da execução.
 */

export type AutomationEmail = {
  to: string;
  subject: string;
  body: string;
  teamName: string;
  automationName: string;
};

const isUrl = (line: string) => /^https?:\/\/\S+$/i.test(line);

function buttonLabel(url: string) {
  if (/\/contrato\//.test(url)) return "Abrir o contrato";
  if (/cobranc|pagar|pagamento|checkout/i.test(url)) return "Pagar agora";
  if (/orcamento/i.test(url)) return "Abrir o orçamento";
  return "Abrir";
}

export async function sendAutomationEmail(input: AutomationEmail): Promise<boolean | "unconfigured"> {
  if (!hasResend()) return "unconfigured";

  const lines = input.body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const url = lines.find(isUrl);
  const paragraphs = lines.filter((line) => line !== url).map((line) => escapeHtml(line));

  return deliver(
    input.to,
    input.subject,
    shell({
      title: input.subject,
      preview: lines.find((line) => !isUrl(line)) ?? input.subject,
      heading: escapeHtml(input.subject),
      lines: paragraphs,
      button: url ? { label: buttonLabel(url), url } : undefined,
      footnote: `Enviado automaticamente pela ${escapeHtml(input.teamName)}. Responda este e-mail para falar com a equipe.`,
      reason: `Você recebeu este e-mail porque a ${escapeHtml(input.teamName)} tem você como cliente ou contato, se não faz sentido, ignore esta mensagem`,
    }),
  );
}
