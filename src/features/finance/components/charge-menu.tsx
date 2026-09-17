"use client";

import { CheckCircleIcon, EyeIcon, LinkIcon, PaperPlaneTiltIcon, XCircleIcon } from "@phosphor-icons/react";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { chargeStatusOf, nextInstallment, type Charge } from "../summary";

export type ChargeMenuActions = {
  /** Abre a ficha; na própria ficha não vai, porque ela já está aberta. */
  onOpen?: () => void;
  /** Envia a cobrança por e-mail, ou reenvia. */
  onSend?: () => void;
  onCopyLink?: () => void;
  /** Confirma o pagamento da próxima parcela em aberto. */
  onPayNext?: () => void;
  onCancel?: () => void;
};

export type ChargeMenuProps = ChargeMenuActions & { charge: Charge };

// As opções de uma cobrança, no padrão do menu das outras listas: abrir a ficha, enviar ou reenviar por
// e-mail, copiar o link do cliente, confirmar a próxima parcela e, por último e em vermelho, cancelar, que
// some do que está pago ou cancelado.
export function ChargeMenu({ charge, onOpen, onSend, onCopyLink, onPayNext, onCancel }: ChargeMenuProps) {
  const status = chargeStatusOf(charge);
  const active = status !== "paid" && status !== "cancelled";
  const next = nextInstallment(charge);

  const sections: DropdownSection[] = [
    {
      id: "actions",
      items: [
        ...(onOpen ? [{ id: "open", label: "Abrir cobrança", icon: EyeIcon, onSelect: onOpen }] : []),
        ...(active && onSend ? [{ id: "send", label: charge.sentAt ? "Reenviar por e-mail" : "Enviar por e-mail", icon: PaperPlaneTiltIcon, onSelect: onSend }] : []),
        ...(onCopyLink ? [{ id: "link", label: "Copiar link do cliente", icon: LinkIcon, onSelect: onCopyLink }] : []),
        ...(active && next && onPayNext ? [{ id: "pay", label: `Confirmar parcela ${next.number}`, icon: CheckCircleIcon, onSelect: onPayNext }] : []),
      ],
    },
    ...(active && onCancel ? [{ id: "danger", items: [{ id: "cancel", label: "Cancelar cobrança", icon: XCircleIcon, tone: "danger" as const, onSelect: onCancel }] }] : []),
  ];

  return <DropdownMenu label={`Opções de ${charge.reference}`} triggerLabel={`Mais opções de ${charge.title}`} sections={sections} />;
}
