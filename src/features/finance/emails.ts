import "server-only";
import { formatMoney } from "@/lib/utils/format";
import { deliver, escapeHtml, shell } from "@/lib/resend/template";
import { installmentLabel, longDate } from "./labels";
import type { Charge, Installment } from "./summary";

/**
 * Os e-mails da cobrança, no casco da casa: a **cobrança** para o cliente, com o valor, a próxima parcela, a
 * forma de pagar e o botão para o link; e o **aviso à equipe** quando o cliente diz pelo link que pagou.
 * Sem Resend configurado nada sai e a função diz isso, para a tela avisar.
 */

const bold = (value: string) => `<strong style="color: #000000; font-weight: 600;">${escapeHtml(value)}</strong>`;

export async function sendChargeEmail(input: { charge: Charge; url: string; issuerName: string; reminder: boolean }) {
  const { charge, url, issuerName, reminder } = input;
  if (!charge.client.email) return false;
  const firstName = charge.client.name.split(" ")[0] ?? charge.client.name;
  const next = [...charge.installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).find((installment) => !installment.paidAt);
  const subject = reminder ? `Lembrete: cobrança ${charge.reference} em aberto` : `Cobrança ${charge.reference}: ${charge.title}`;
  const parcel = next ? `${installmentLabel(next.number, charge.installments.length)}, ${formatMoney(next.amount)}, vence em ${longDate(next.dueDate)}.` : "";

  return deliver(
    charge.client.email,
    subject,
    shell({
      title: subject,
      preview: `${issuerName} enviou a cobrança de ${formatMoney(charge.amount)} referente a ${charge.title}`,
      heading: `Olá, ${escapeHtml(firstName)}`,
      lines: [
        reminder ? `Este é um lembrete: a cobrança ${bold(charge.reference)}, referente a ${bold(charge.title)}, segue em aberto.` : `${escapeHtml(issuerName)} enviou a cobrança ${bold(charge.reference)}, referente a ${bold(charge.title)}, no valor de ${bold(formatMoney(charge.amount))}${charge.installments.length > 1 ? ` em ${charge.installments.length} parcelas` : ""}.`,
        ...(parcel ? [escapeHtml(parcel)] : []),
        ...(charge.paymentInfo ? [`Como pagar: ${escapeHtml(charge.paymentInfo)}`] : []),
        "Pelo botão abaixo você vê as parcelas, a forma de pagamento e avisa quando pagar.",
      ],
      button: { label: "Ver a cobrança", url },
      footnote: "Este link é pessoal. Se já pagou, ignore esta mensagem.",
      reason: `Você recebeu este e-mail porque ${escapeHtml(issuerName)} emitiu uma cobrança para você, se não faz sentido, ignore esta mensagem`,
    }),
  );
}

export async function sendPaymentReportedEmail(input: { to: string; charge: Charge; installment: Installment; appUrl: string }) {
  const { to, charge, installment, appUrl } = input;
  const subject = `${charge.client.name} avisou o pagamento da ${installmentLabel(installment.number, charge.installments.length).toLowerCase()} de ${charge.reference}`;
  return deliver(
    to,
    subject,
    shell({
      title: subject,
      preview: `Confirme o recebimento de ${formatMoney(installment.amount)}`,
      heading: "Pagamento avisado pelo cliente",
      lines: [
        `${bold(charge.client.name)} disse pelo link que pagou a ${escapeHtml(installmentLabel(installment.number, charge.installments.length).toLowerCase())} da cobrança ${bold(charge.reference)} (${escapeHtml(charge.title)}), de ${bold(formatMoney(installment.amount))}, com vencimento em ${escapeHtml(longDate(installment.dueDate))}.`,
        "Confira o extrato e confirme o recebimento na ficha da cobrança: a entrada só entra no caixa quando você confirma.",
      ],
      button: { label: "Abrir a cobrança", url: appUrl },
      footnote: "Enviado pela sua conta na Specular.",
      reason: "Você recebeu este e-mail porque é da equipe que emitiu a cobrança",
    }),
  );
}
