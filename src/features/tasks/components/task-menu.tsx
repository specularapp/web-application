"use client";

import { ArrowSquareOutIcon, CheckCircleIcon, CopySimpleIcon, HashIcon, PencilSimpleIcon, TrashIcon } from "@phosphor-icons/react";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/providers/toast-provider";
import { statusOf } from "../labels";
import type { Task } from "../summary";

export type TaskMenuProps = {
  task: Task;
  /** Abre a ficha completa da tarefa, a mesma que o cartão abre no clique. */
  onOpen?: () => void;
};

// As opções de uma tarefa, no padrão do menu do cliente, do catálogo e do orçamento: abrir a ficha, editar,
// copiar o identificador, duplicar, concluir e, por último e em vermelho, excluir. Abrir e copiar funcionam;
// o resto fecha o menu e nada mais, enquanto o domínio não está no banco, como as opções do cliente
// nasceram. Concluir só aparece no que ainda não fechou, porque marcar de novo o que já está concluído não é
// ação nenhuma.
export function TaskMenu({ task, onOpen }: TaskMenuProps) {
  const { toast } = useToast();

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(task.reference);
      toast({ title: "Identificador copiado", description: `${task.reference} está na área de transferência.`, tone: "success" });
    } catch {
      toast({ title: "Não deu para copiar", description: task.reference, tone: "warning" });
    }
  };

  const sections: DropdownSection[] = [
    {
      id: "actions",
      items: [
        { id: "open", label: "Abrir tarefa", icon: ArrowSquareOutIcon, onSelect: onOpen },
        { id: "edit", label: "Editar", icon: PencilSimpleIcon },
        { id: "copy", label: "Copiar identificador", icon: HashIcon, onSelect: () => void copyReference() },
      ],
    },
    {
      id: "more",
      items: [
        { id: "duplicate", label: "Duplicar", icon: CopySimpleIcon },
        ...(statusOf(task) === "done" ? [] : [{ id: "done", label: "Marcar como concluída", icon: CheckCircleIcon }]),
      ],
    },
    { id: "danger", items: [{ id: "delete", label: "Excluir", icon: TrashIcon, tone: "danger" as const }] },
  ];

  return <DropdownMenu label={`Opções de ${task.reference}`} triggerLabel={`Mais opções de ${task.title}`} sections={sections} size="sm" />;
}
