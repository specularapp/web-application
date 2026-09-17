"use client";

import { ClockCounterClockwiseIcon, CopySimpleIcon, LightningIcon, PauseCircleIcon, PencilSimpleIcon, PlayIcon, TrashIcon } from "@phosphor-icons/react";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import type { Automation } from "../summary";

export type AutomationMenuActions = {
  onEdit?: () => void;
  onTest?: () => void;
  onToggle?: () => void;
  onDuplicate?: () => void;
  onHistory?: () => void;
  onDelete?: () => void;
};

export type AutomationMenuProps = AutomationMenuActions & {
  automation: Pick<Automation, "name" | "status" | "runCount">;
};

// As opções de uma automação, no padrão do menu do cliente, do projeto e do contrato: abrir o editor, testar
// agora, ativar ou pausar conforme a situação, duplicar, o histórico de execuções e, por último e em
// vermelho, excluir. Cada opção só aparece quando quem monta o menu tem o que fazer com ela.
export function AutomationMenu({ automation, onEdit, onTest, onToggle, onDuplicate, onHistory, onDelete }: AutomationMenuProps) {
  const active = automation.status === "active";

  const sections: DropdownSection[] = [
    {
      id: "actions",
      items: [
        ...(onEdit ? [{ id: "edit", label: "Abrir o editor", icon: PencilSimpleIcon, onSelect: onEdit }] : []),
        ...(onTest ? [{ id: "test", label: "Testar agora", icon: PlayIcon, onSelect: onTest }] : []),
        ...(onToggle ? [{ id: "toggle", label: active ? "Pausar" : "Ativar", icon: active ? PauseCircleIcon : LightningIcon, onSelect: onToggle }] : []),
        ...(onDuplicate ? [{ id: "duplicate", label: "Duplicar", icon: CopySimpleIcon, onSelect: onDuplicate }] : []),
      ],
    },
    ...(onHistory
      ? [
          {
            id: "tracking",
            label: "Acompanhamento",
            items: [{ id: "history", label: "Execuções", icon: ClockCounterClockwiseIcon, count: automation.runCount, onSelect: onHistory }],
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            id: "danger",
            items: [{ id: "delete", label: "Excluir", icon: TrashIcon, tone: "danger" as const, onSelect: onDelete }],
          },
        ]
      : []),
  ];

  return <DropdownMenu label={`Opções de ${automation.name}`} triggerLabel={`Mais opções de ${automation.name}`} sections={sections} />;
}
