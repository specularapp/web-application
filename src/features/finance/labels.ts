import type { Icon } from "@phosphor-icons/react";
import { ArrowDownLeftIcon, ArrowUpRightIcon, BankIcon, BarcodeIcon, CalendarCheckIcon, CheckCircleIcon, ClockIcon, CreditCardIcon, HourglassMediumIcon, PixLogoIcon, WarningCircleIcon, XCircleIcon } from "@phosphor-icons/react/ssr";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { BadgeTone } from "@/components/ui/badge";
import type { Charge, ChargeMethod, ChargeRecurrence, ChargeStatus, FinancePeriod, InstallmentStatus, TransactionKind } from "./summary";

/**
 * Quem paga, como toda tela mostra. Na cobrança com cliente é o cliente; na **avulsa** não há ninguém da
 * base, e quem dá nome à cobrança é o próprio título, com a foto no lugar do rosto.
 *
 * Mora aqui, e não em cada tela, porque são sete lugares que desenham a mesma linha (o cartão, a tabela, a
 * ficha, o link do pagador, os avisos, o e-mail e a busca): sete `charge.client ?? ...` sairiam de sincronia
 * na primeira mudança de texto.
 */
export function payerOf(charge: Pick<Charge, "client" | "title" | "imageUrl">) {
  if (charge.client) {
    return {
      name: charge.client.name,
      company: charge.client.company,
      email: charge.client.email,
      avatarUrl: charge.client.avatarUrl,
      clientId: charge.client.id,
      standalone: false as const,
    };
  }

  return { name: charge.title, company: undefined, email: null, avatarUrl: charge.imageUrl, clientId: null, standalone: true as const };
}

/** O nome do ciclo, como a pessoa lê, no seletor da criação e na etiqueta da ficha. */
export const recurrenceLabels: Record<ChargeRecurrence, string> = {
  none: "Não se repete",
  monthly: "Todo mês",
  quarterly: "A cada três meses",
  yearly: "Todo ano",
};

/** De quantos em quantos meses cada ciclo cai: é a conta do vencimento da próxima. */
export const recurrenceMonths: Record<ChargeRecurrence, number> = { none: 0, monthly: 1, quarterly: 3, yearly: 12 };

/* As situações da cobrança: em aberto ainda não venceu, parcial já recebeu parte, vencida tem parcela
   atrasada, paga fechou, cancelada saiu. Os mesmos glifos e tons no cartão, na tabela, na ficha e no filtro. */
export const chargeStatuses: Record<ChargeStatus, { label: string; tone: BadgeTone; icon: Icon }> = {
  open: { label: "Em aberto", tone: "info", icon: ClockIcon },
  partial: { label: "Parcial", tone: "warning", icon: HourglassMediumIcon },
  overdue: { label: "Vencida", tone: "danger", icon: WarningCircleIcon },
  paid: { label: "Paga", tone: "success", icon: CheckCircleIcon },
  cancelled: { label: "Cancelada", tone: "neutral", icon: XCircleIcon },
};

export const installmentStatuses: Record<InstallmentStatus, { label: string; tone: BadgeTone }> = {
  open: { label: "Em aberto", tone: "info" },
  overdue: { label: "Vencida", tone: "danger" },
  paid: { label: "Paga", tone: "success" },
  cancelled: { label: "Cancelada", tone: "neutral" },
};

export const chargeMethods: Record<ChargeMethod, { label: string; icon: Icon; hint: string }> = {
  pix: { label: "Pix", icon: PixLogoIcon, hint: "A chave Pix que o cliente vai usar" },
  boleto: { label: "Boleto", icon: BarcodeIcon, hint: "Onde o cliente pega o boleto, ou o código" },
  transfer: { label: "Transferência", icon: BankIcon, hint: "Banco, agência e conta" },
  card: { label: "Cartão", icon: CreditCardIcon, hint: "O link de pagamento do cartão" },
};

export const transactionKinds: Record<TransactionKind, { label: string; tone: BadgeTone; icon: Icon; sign: string }> = {
  income: { label: "Entrada", tone: "success", icon: ArrowDownLeftIcon, sign: "+" },
  expense: { label: "Saída", tone: "danger", icon: ArrowUpRightIcon, sign: "-" },
  scheduled: { label: "Prevista", tone: "info", icon: CalendarCheckIcon, sign: "" },
};

export const financePeriods: { value: FinancePeriod; label: string }[] = [
  { value: "mes", label: "Este mês" },
  { value: "trimestre", label: "Este trimestre" },
  { value: "ano", label: "Este ano" },
  { value: "tudo", label: "Desde o começo" },
];

/** "8 mar." */
export const shortDate = (iso: string) => format(parseISO(iso), "d MMM.", { locale: ptBR });

/** "8 de março de 2026". */
export const longDate = (iso: string) => format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: ptBR });

/** "15 set., 10:42", para a linha do tempo. */
export const momentLabel = (iso: string) => format(parseISO(iso), "d MMM., HH:mm", { locale: ptBR });

export const installmentLabel = (number: number, total: number) => (total > 1 ? `Parcela ${number} de ${total}` : "Parcela única");

/** O vencimento em palavras, olhando para hoje: "Vence em 3 dias", "Vence hoje", "Venceu há 2 dias". */
export function dueLabel(dueDate: string, today = new Date()) {
  const days = differenceInCalendarDays(parseISO(dueDate), today);
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  if (days === -1) return "Venceu ontem";
  return days > 0 ? `Vence em ${days} dias` : `Venceu há ${-days} dias`;
}

/** O tom do vencimento: vermelho vencido, laranja perto, neutro longe. */
export function dueTone(dueDate: string, today = new Date()): BadgeTone {
  const days = differenceInCalendarDays(parseISO(dueDate), today);
  return days < 0 ? "danger" : days <= 3 ? "warning" : "neutral";
}
