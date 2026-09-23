"use client";

import { ArrowsClockwiseIcon, CheckCircleIcon, EyeIcon, LinkIcon, PaperPlaneTiltIcon, XCircleIcon } from "@phosphor-icons/react";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { chargeStatusOf, nextInstallment, type Charge } from "../summary";
import { chargeDirections } from "../labels";

export type ChargeMenuActions = {
  /** Abre a ficha; na própria ficha não vai, porque ela já está aberta. */
  onOpen?: () => void;
  /** Envia a cobrança por e-mail, ou reenvia. */
  onSend?: () => void;
  onCopyLink?: () => void;
  /** Confirma o pagamento da próxima parcela em aberto. */
  onPayNext?: () => void;
  /** Encerra a série recorrente: só aparece na cobrança que se repete. */
  onStopRecurrence?: () => void;
  onCancel?: () => void;
};

export type ChargeMenuProps = ChargeMenuActions & { charge: Charge };

// As opções de uma cobrança, no padrão do menu das outras listas: abrir a ficha, enviar ou reenviar por
// e-mail, copiar o link do cliente, confirmar a próxima parcela e, por último e em vermelho, cancelar, que
// some do que está pago ou cancelado.
export function ChargeMenu({ charge, onOpen, onSend, onCopyLink, onPayNext, onStopRecurrence, onCancel }: ChargeMenuProps) {
  const status = chargeStatusOf(charge);
  const active = status !== "paid" && status !== "cancelled";
  const next = nextInstallment(charge);
  const side = chargeDirections[charge.direction];
  const noun = side.label.toLocaleLowerCase("pt-BR");

  /* A primeira seção entra junto com o item, e não antes dele: montada sempre, ela chegava vazia ao leque do
     cartão e da ficha, que não passam `onOpen`, e desenhava uma faixa em branco com um fio divisor por cima
     do primeiro grupo de verdade, além de um grupo sem rótulo e sem filho na árvore de acessibilidade. */
  const sections: DropdownSection[] = [
    ...(onOpen ? [{ id: "actions", items: [{ id: "open", label: `Abrir ${noun}`, icon: EyeIcon, onSelect: onOpen }] }] : []),
    ...((active && onSend) || onCopyLink
      ? [{
          id: "share",
          label: "Compartilhar",
          items: [
        ...(active && onSend ? [{ id: "send", label: charge.sentAt ? "Reenviar por e-mail" : "Enviar por e-mail", icon: PaperPlaneTiltIcon, onSelect: onSend }] : []),
        ...(onCopyLink ? [{ id: "link", label: "Copiar link do cliente", icon: LinkIcon, onSelect: onCopyLink }] : []),
          ],
        }]
      : []),
    ...(active && next && onPayNext
      ? [{ id: "payment", label: charge.direction === "outgoing" ? "Pagamento" : "Recebimento", items: [{ id: "pay", label: `Confirmar parcela ${next.number}`, icon: CheckCircleIcon, onSelect: onPayNext }] }]
      : []),
    ...(charge.recurrence !== "none" && onStopRecurrence
      ? [{ id: "series", label: "Recorrência", items: [{ id: "stop", label: "Encerrar recorrência", icon: ArrowsClockwiseIcon, onSelect: onStopRecurrence }] }]
      : []),
    ...(active && onCancel ? [{ id: "danger", items: [{ id: "cancel", label: `Cancelar ${noun}`, icon: XCircleIcon, tone: "danger" as const, onSelect: onCancel }] }] : []),
  ];

  /* Sem nenhuma opção não há leque (2026-09-22, na varredura): no cartão de uma despesa paga ou cancelada não
     sobrava item nenhum (não há link, não há parcela a confirmar, não há o que cancelar, e o cartão não passa
     `onOpen`), e o gatilho abria uma caixa com "Nada bateu com o que você procurou." num leque que nunca teve
     campo de busca. Botão que não faz nada não fica na tela. */
  if (sections.length === 0) return null;

  return <DropdownMenu label={`Opções de ${charge.reference}`} triggerLabel={`Mais opções de ${charge.title}`} sections={sections} />;
}
