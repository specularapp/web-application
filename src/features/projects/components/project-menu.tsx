"use client";

import {
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  CurrencyCircleDollarIcon,
  EyeIcon,
  KanbanIcon,
  PauseCircleIcon,
  PencilSimpleIcon,
  PlayCircleIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import type { Project } from "../summary";

export type ProjectMenuProps = {
  /** Só o que o menu usa: o cartão carrega o projeto inteiro, mas o menu não precisa dele. */
  project: Pick<Project, "slug" | "reference" | "name" | "status">;
  /** Abre a janela do projeto; na própria janela não vai, porque ela já está aberta. */
  onOpen?: () => void;
  /** Abre a ficha para editar, na gaveta lateral. */
  onEdit?: () => void;
  /** Pede a exclusão; quem confirma é a janela da casa, com a pergunta e o aviso. */
  onDelete?: () => void;
};

/** Gerar cobrança a partir do projeto pede o plano Pro, como os documentos do cliente. */
const INVOICE_PLAN = "pro";

// As opções de um projeto, no padrão do menu do cliente, do catálogo e do orçamento: abrir a janela dele,
// abrir o quadro de tarefas, que já existe em `/tarefas/<slug>`, editar e gerar cobrança com o selo do plano
// que libera; o acompanhamento, com pausar, retomar ou concluir conforme a situação; e, por último e em
// vermelho, excluir. Abrir, o quadro e editar funcionam; o resto fecha o menu e nada mais, como as opções do
// cliente nasceram, até a regra existir.
export function ProjectMenu({ project, onOpen, onEdit, onDelete }: ProjectMenuProps) {
  const sections: DropdownSection[] = [
    {
      id: "actions",
      items: [
        ...(onOpen ? [{ id: "open", label: "Abrir projeto", icon: EyeIcon, onSelect: onOpen }] : []),
        { id: "board", label: "Abrir quadro de tarefas", icon: KanbanIcon, href: `/tarefas/${project.slug}` as Route },
        { id: "edit", label: "Editar", icon: PencilSimpleIcon, onSelect: onEdit },
        { id: "invoice", label: "Gerar cobrança", icon: CurrencyCircleDollarIcon, href: "/cobrancas", submenu: true, plan: INVOICE_PLAN },
      ],
    },
    {
      id: "tracking",
      label: "Acompanhamento",
      items: [
        { id: "history", label: "Histórico", icon: ClockCounterClockwiseIcon },
        ...(project.status === "active"
          ? [
              { id: "pause", label: "Pausar", icon: PauseCircleIcon },
              { id: "finish", label: "Marcar como concluído", icon: CheckCircleIcon },
            ]
          : []),
        ...(project.status === "paused" ? [{ id: "resume", label: "Retomar", icon: PlayCircleIcon }] : []),
      ],
    },
    {
      id: "danger",
      items: [{ id: "delete", label: "Excluir", icon: TrashIcon, tone: "danger", onSelect: onDelete }],
    },
  ];

  return <DropdownMenu label={`Opções de ${project.reference}`} triggerLabel={`Mais opções de ${project.name}`} sections={sections} />;
}
