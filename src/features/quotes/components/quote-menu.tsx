"use client";

import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  CopySimpleIcon,
  LinkIcon,
  PaperPlaneTiltIcon,
  PencilSimpleIcon,
  TrashIcon,
  WhatsappLogoIcon,
} from "@phosphor-icons/react";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/providers/toast-provider";
import { quoteShareUrl, quoteWhatsappUrl } from "../share";
import type { Quote } from "../summary";

export type QuoteMenuProps = {
  quote: Quote;
  /** Abre o editor no lugar, com o orçamento já preenchido. */
  onEdit?: () => void;
};

// As opções de um orçamento, no padrão do menu do cliente e do catálogo: abrir o documento como o cliente
// vê, editar, enviar pelo WhatsApp com a mensagem pronta, copiar o link público; o acompanhamento; marcar
// como enviado ou aprovado à mão, para quem fechou por fora; duplicar; e, por último e em vermelho, excluir.
// Enviar, copiar e abrir funcionam; marcar, duplicar, histórico e excluir ainda não têm regra: fecham o menu
// e nada mais, como as opções do cliente nasceram.
export function QuoteMenu({ quote, onEdit }: QuoteMenuProps) {
  const { toast } = useToast();
  const url = quoteShareUrl(quote.shareToken);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado", description: "Cole no WhatsApp ou no e-mail do cliente.", tone: "success" });
    } catch {
      toast({ title: "Não deu para copiar", description: url, tone: "warning" });
    }
  };

  const sections: DropdownSection[] = [
    {
      id: "actions",
      items: [
        { id: "open", label: "Abrir documento", icon: ArrowSquareOutIcon, href: url as `http${string}` },
        { id: "edit", label: "Editar", icon: PencilSimpleIcon, onSelect: onEdit },
        { id: "whatsapp", label: "Enviar pelo WhatsApp", icon: WhatsappLogoIcon, href: quoteWhatsappUrl(quote) as `http${string}` },
        { id: "copy", label: "Copiar link", icon: LinkIcon, onSelect: () => void copyLink() },
      ],
    },
    {
      id: "tracking",
      label: "Acompanhamento",
      items: [
        { id: "history", label: "Histórico", icon: ClockCounterClockwiseIcon },
        ...(quote.status === "draft" ? [{ id: "mark-sent", label: "Marcar como enviado", icon: PaperPlaneTiltIcon }] : []),
        ...(quote.status === "sent" || quote.status === "viewed" ? [{ id: "mark-approved", label: "Marcar como aprovado", icon: CheckCircleIcon }] : []),
      ],
    },
    {
      id: "more",
      items: [{ id: "duplicate", label: "Duplicar", icon: CopySimpleIcon }],
    },
    {
      id: "danger",
      items: [{ id: "delete", label: "Excluir", icon: TrashIcon, tone: "danger" }],
    },
  ];

  return <DropdownMenu label={`Opções de ${quote.number}`} triggerLabel={`Mais opções de ${quote.number}`} sections={sections} />;
}

