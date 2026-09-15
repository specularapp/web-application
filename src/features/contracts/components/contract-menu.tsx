"use client";

import { ClockCounterClockwiseIcon, DownloadSimpleIcon, EyeIcon, PaperPlaneTiltIcon, PencilSimpleIcon, XCircleIcon } from "@phosphor-icons/react";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import type { Contract } from "../summary";

export type ContractMenuActions = {
  /** Abre a ficha do contrato; na própria ficha não vai, porque ela já está aberta. */
  onOpen?: () => void;
  onEdit?: () => void;
  /** Enviar o convite de assinatura (rascunho) ou reenviá-lo (aguardando ou parcial). */
  onSend?: () => void;
  onDownload?: () => void;
  onHistory?: () => void;
  onCancel?: () => void;
};

export type ContractMenuProps = ContractMenuActions & {
  /** Só o que o menu usa: o cartão carrega o contrato inteiro, mas o menu não precisa dele. */
  contract: Pick<Contract, "reference" | "title" | "status">;
};

// As opções de um contrato, no padrão do menu do cliente, do orçamento e do projeto: abrir a ficha, editar
// (só rascunho, porque documento enviado não muda por baixo de quem vai assinar), enviar ou reenviar o convite
// de assinatura conforme a situação, baixar o PDF; o acompanhamento com o histórico; e, por último e em
// vermelho, cancelar, que some do que já está assinado ou cancelado. Cada opção só aparece quando quem monta
// o menu tem o que fazer com ela.
export function ContractMenu({ contract, onOpen, onEdit, onSend, onDownload, onHistory, onCancel }: ContractMenuProps) {
  const draft = contract.status === "draft";
  const open = contract.status === "sent" || contract.status === "partial";

  const sections: DropdownSection[] = [
    {
      id: "actions",
      items: [
        ...(onOpen ? [{ id: "open", label: "Abrir contrato", icon: EyeIcon, onSelect: onOpen }] : []),
        ...(draft && onEdit ? [{ id: "edit", label: "Editar", icon: PencilSimpleIcon, onSelect: onEdit }] : []),
        ...(draft && onSend ? [{ id: "send", label: "Enviar para assinatura", icon: PaperPlaneTiltIcon, onSelect: onSend }] : []),
        ...(open && onSend ? [{ id: "resend", label: "Reenviar convite", icon: PaperPlaneTiltIcon, onSelect: onSend }] : []),
        ...(onDownload ? [{ id: "download", label: "Baixar PDF", icon: DownloadSimpleIcon, onSelect: onDownload }] : []),
      ],
    },
    ...(onHistory
      ? [
          {
            id: "tracking",
            label: "Acompanhamento",
            items: [{ id: "history", label: "Linha do tempo", icon: ClockCounterClockwiseIcon, onSelect: onHistory }],
          },
        ]
      : []),
    ...(contract.status !== "signed" && contract.status !== "cancelled" && onCancel
      ? [
          {
            id: "danger",
            items: [{ id: "cancel", label: "Cancelar contrato", icon: XCircleIcon, tone: "danger" as const, onSelect: onCancel }],
          },
        ]
      : []),
  ];

  return <DropdownMenu label={`Opções de ${contract.reference}`} triggerLabel={`Mais opções de ${contract.title}`} sections={sections} />;
}
