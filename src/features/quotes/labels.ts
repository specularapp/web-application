import type { Icon } from "@phosphor-icons/react";
import { CheckCircleIcon, ClockIcon, EyeIcon, FileDashedIcon, HourglassIcon, XCircleIcon } from "@phosphor-icons/react/ssr";
import type { BadgeTone } from "@/components/ui/badge";
import type { QuoteStatus } from "./summary";

/* A situação do orçamento em etiqueta: rótulo, tom e ícone, os mesmos no bloco do painel e na ficha do cliente. */
export const quoteStatuses: Record<QuoteStatus, { label: string; tone: BadgeTone; icon: Icon }> = {
  draft: { label: "Rascunho", tone: "neutral", icon: FileDashedIcon },
  sent: { label: "Enviado", tone: "accent", icon: ClockIcon },
  viewed: { label: "Visualizado", tone: "info", icon: EyeIcon },
  approved: { label: "Aprovado", tone: "success", icon: CheckCircleIcon },
  declined: { label: "Recusado", tone: "danger", icon: XCircleIcon },
  expired: { label: "Vencido", tone: "warning", icon: HourglassIcon },
};
