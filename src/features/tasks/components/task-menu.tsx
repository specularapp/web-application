"use client";

import { CheckCircleIcon, CopySimpleIcon, EyeIcon, HashIcon, TrashIcon } from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/providers/toast-provider";
import { callAction } from "@/lib/action";
import { duplicateTaskAction } from "../actions";
import { statusOf } from "../labels";
import { taskStageMeta, type TaskStage } from "../stages";
import type { Task } from "../summary";

export type TaskMenuProps = {
  task: Task;
  /** Abre a ficha completa da tarefa, a mesma que o cartão abre no clique. */
  onOpen?: () => void;
  /** As etapas do quadro onde a tarefa está: são elas que "Mover para" oferece. */
  stages?: TaskStage[];
  /** Leva a tarefa para outra etapa. Sem isto, a seção de mover não aparece. */
  onMove?: (stage: TaskStage) => void;
  /** Pede a exclusão; quem confirma é a janela da casa, com a pergunta e o aviso. */
  onDelete?: () => void;
};

// As opções de uma tarefa: abrir a ficha, copiar o identificador, mover de etapa, duplicar, concluir e, por
// último e em vermelho, excluir.
//
// Não há "Editar" aqui: a ficha da tarefa **é** o editor, com os campos à mão, então abrir e editar seriam a
// mesma linha escrita duas vezes. Concluir só aparece no que ainda não fechou, e só quando o quadro tem uma
// etapa de fechamento para onde mandar, porque marcar de novo o que já está concluído não é ação nenhuma.
export function TaskMenu({ task, onOpen, stages, onMove, onDelete }: TaskMenuProps) {
  const { toast } = useToast();

  /* A etapa de fechamento **deste** quadro: um projeto pode nomear as suas, e concluir é mandar para a que
     o catálogo marca como fim. Sem ela, a opção não aparece em vez de apontar para uma coluna que não existe. */
  const closing = stages?.find((id) => taskStageMeta[id].kind === "done");

  const duplicate = async () => {
    const result = await callAction(duplicateTaskAction(task.id));
    if (!result.ok) {
      toast({ title: "Não deu para duplicar", description: result.error, tone: "danger" });
      return;
    }
    toast({ title: "Tarefa duplicada", description: `Uma cópia de ${task.reference} entrou logo abaixo.`, tone: "success" });
  };

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(task.reference);
      toast({ title: "Identificador copiado", description: `${task.reference} está na área de transferência.`, tone: "success" });
    } catch {
      toast({ title: "Não deu para copiar", description: task.reference, tone: "warning" });
    }
  };

  /**
   * Mover de etapa pelo leque (2026-09-11, a pedido): no celular o cartão não se arrasta, então este é o
   * caminho curto, e no desktop ele é o atalho de teclado que o arraste nunca foi. As opções são as etapas
   * **deste quadro**, e não as do catálogo, pelo mesmo motivo da ficha: mandar a tarefa para uma etapa que o
   * projeto não tem a deixaria sem coluna onde cair. A etapa em que ela já está entra marcada e muda
   * nada, como em toda escolha única da casa.
   */
  const moveSection: DropdownSection[] =
    onMove && stages && stages.length > 1
      ? [
          {
            id: "move",
            label: "Mover para",
            items: stages.map((id) => {
              const meta = taskStageMeta[id];
              const Glyph = meta.icon;
              return {
                id: `move-${id}`,
                label: meta.label,
                media: <Glyph weight="bold" style={{ color: meta.hue } as CSSProperties} />,
                selected: task.stage === id,
                onSelect: () => onMove(id),
              };
            }),
          },
        ]
      : [];

  const sections: DropdownSection[] = [
    {
      id: "actions",
      items: [
        ...(onOpen ? [{ id: "open", label: "Abrir tarefa", icon: EyeIcon, onSelect: onOpen }] : []),
        { id: "copy", label: "Copiar identificador", icon: HashIcon, onSelect: () => void copyReference() },
      ],
    },
    ...moveSection,
    {
      id: "more",
      label: "Mais ações",
      items: [
        { id: "duplicate", label: "Duplicar", icon: CopySimpleIcon, onSelect: () => void duplicate() },
        ...(statusOf(task) === "done" || !closing || !onMove
          ? []
          : [{ id: "done", label: "Marcar como concluída", icon: CheckCircleIcon, onSelect: () => onMove(closing) }]),
      ],
    },
    ...(onDelete
      ? [{ id: "danger", items: [{ id: "delete", label: "Excluir", icon: TrashIcon, tone: "danger" as const, onSelect: onDelete }] }]
      : []),
  ];

  return <DropdownMenu label={`Opções de ${task.reference}`} triggerLabel={`Mais opções de ${task.title}`} sections={sections} size="sm" />;
}
