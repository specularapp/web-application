import type { Icon } from "@phosphor-icons/react";
import {
  CheckCircleIcon,
  ClockIcon,
  FileDashedIcon,
  FilePdfIcon,
  LayoutIcon,
  PencilLineIcon,
  SignatureIcon,
  XCircleIcon,
} from "@phosphor-icons/react/ssr";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { BadgeTone } from "@/components/ui/badge";
import type { Contract, ContractKind, ContractSource, ContractStatus } from "./summary";

/* A situação do contrato em etiqueta: rótulo, tom e ícone, os mesmos no cartão, no menu de filtros e na
   etiqueta do filtro em vigor. Rótulos curtos de propósito: a etiqueta divide a cabeça do cartão com a do
   tipo e com o leque numa coluna de 17rem. */
export const contractStatuses: Record<ContractStatus, { label: string; tone: BadgeTone; icon: Icon }> = {
  draft: { label: "Rascunho", tone: "neutral", icon: FileDashedIcon },
  sent: { label: "Aguardando", tone: "accent", icon: ClockIcon },
  partial: { label: "Parcial", tone: "warning", icon: SignatureIcon },
  signed: { label: "Assinado", tone: "success", icon: CheckCircleIcon },
  cancelled: { label: "Cancelado", tone: "danger", icon: XCircleIcon },
};

/* De onde o contrato nasceu: o glifo e o nome, os mesmos no modal de criar, no filtro e no leque. */
export const contractSources: Record<ContractSource, { label: string; icon: Icon }> = {
  pdf: { label: "PDF anexado", icon: FilePdfIcon },
  template: { label: "Modelo pronto", icon: LayoutIcon },
  scratch: { label: "Do zero", icon: PencilLineIcon },
};

/**
 * O tipo do trabalho, com o matiz da etiqueta do topo do cartão: é a peça colorida da referência ("Web
 * design", "Mobile Design", "Invoice"). Matiz escolhido à mão por família, como nas etiquetas de tarefa e de
 * projeto: desenho em roxo e rosa, código em azul e ciano, entrega em verde, relação em laranja.
 */
export const contractKinds: Record<ContractKind, { label: string; hue: string }> = {
  landing: { label: "Landing page", hue: "var(--sys-green)" },
  institutional: { label: "Institucional", hue: "var(--sys-blue)" },
  ecommerce: { label: "Loja virtual", hue: "var(--sys-teal)" },
  app: { label: "Aplicativo", hue: "var(--sys-cyan)" },
  branding: { label: "Branding", hue: "var(--sys-pink)" },
  uiux: { label: "UI/UX", hue: "var(--sys-purple)" },
  maintenance: { label: "Manutenção", hue: "var(--sys-mint)" },
  content: { label: "Conteúdo", hue: "var(--sys-orange)" },
  other: { label: "Outro", hue: "var(--sys-gray)" },
};

/** A data curta da casa, sem o ano: "8 mar." */
export const shortDate = (iso: string) => format(parseISO(iso), "d MMM.", { locale: ptBR });

export type ContractDateReading = { label: string; tone: BadgeTone };

/**
 * A data que importa na situação em que o contrato está, para a etiqueta do pé do cartão (a referência traz
 * a data com o calendário no pé): assinado diz quando assinou; aguardando diz até quando o convite vale, em
 * vermelho no vencido e em laranja perto de vencer; rascunho e cancelado dizem quando nasceram.
 */
export function dateOf(contract: Contract): ContractDateReading {
  if (contract.status === "signed" && contract.signedAt) return { label: `Assinado ${shortDate(contract.signedAt)}`, tone: "success" };

  if ((contract.status === "sent" || contract.status === "partial") && contract.expiresAt) {
    const days = differenceInCalendarDays(parseISO(contract.expiresAt), new Date());
    if (days < 0) return { label: "Convite vencido", tone: "danger" };
    if (days === 0) return { label: "Vence hoje", tone: "danger" };
    if (days <= 3) return { label: `Vence em ${days} ${days === 1 ? "dia" : "dias"}`, tone: "warning" };
    return { label: `Vence ${shortDate(contract.expiresAt)}`, tone: "neutral" };
  }

  if (contract.sentAt) return { label: `Enviado ${shortDate(contract.sentAt)}`, tone: "neutral" };
  return { label: `Criado ${shortDate(contract.createdAt)}`, tone: "neutral" };
}
