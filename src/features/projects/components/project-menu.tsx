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
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { setProjectStatusAction } from "../actions";
import type { Project, ProjectStatus } from "../summary";

/* A janela do histórico chega só quando alguém a abre: o leque aparece em cada cartão da grade. */
const HistoryDialog = dynamic(() => import("@/features/records/components/history-dialog").then((module) => module.HistoryDialog));

export type ProjectMenuProps = {
  /** Só o que o menu usa: o cartão carrega o projeto inteiro, mas o menu não precisa dele. */
  project: Pick<Project, "id" | "slug" | "reference" | "name" | "status" | "client">;
  /** Abre a janela do projeto; na própria janela não vai, porque ela já está aberta. */
  onOpen?: () => void;
  /** Abre a ficha para editar, na gaveta lateral. */
  onEdit?: () => void;
  /** Pede a exclusão; quem confirma é a janela da casa, com a pergunta e o aviso. */
  onDelete?: () => void;
};

/** Gerar cobrança a partir do projeto pede o plano Pro, como os documentos do cliente. */
const INVOICE_PLAN = "pro";

// As opções de um projeto, todas funcionando: abrir a janela dele, abrir o quadro de tarefas em
// `/tarefas/<slug>`, editar, gerar cobrança já com o cliente do projeto (com o selo do plano que libera); o
// histórico em janela e pausar, retomar ou concluir conforme a situação, que gravam na hora; e, por último e
// em vermelho, excluir.
export function ProjectMenu({ project, onOpen, onEdit, onDelete }: ProjectMenuProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [history, setHistory] = useState<"never" | "open" | "closed">("never");

  const setStatus = async (status: ProjectStatus, title: string) => {
    const result = await setProjectStatusAction({ id: project.id, status });
    if (!result.ok) {
      toast({ title: "Não deu para mudar a situação", description: result.error, tone: "danger" });
      return;
    }
    toast({ title, description: `${project.name} já está assim na lista e no menu.`, tone: "success" });
    router.refresh();
  };

  /* A cobrança nasce já com o cliente do projeto, quando ele tem um; projeto independente abre a gaveta em
     branco, e a pessoa escolhe (ou deixa avulsa). */
  const invoiceHref = (project.client ? `/cobrancas/nova?cliente=${project.client.id}` : "/cobrancas/nova") as Route;

  const sections: DropdownSection[] = [
    {
      id: "actions",
      items: [
        ...(onOpen ? [{ id: "open", label: "Abrir projeto", icon: EyeIcon, onSelect: onOpen }] : []),
        { id: "board", label: "Abrir quadro de tarefas", icon: KanbanIcon, href: `/tarefas/${project.slug}` as Route },
        { id: "edit", label: "Editar", icon: PencilSimpleIcon, onSelect: onEdit },
        { id: "invoice", label: "Gerar cobrança", icon: CurrencyCircleDollarIcon, href: invoiceHref, submenu: true, plan: INVOICE_PLAN },
      ],
    },
    {
      id: "tracking",
      label: "Acompanhamento",
      items: [
        { id: "history", label: "Histórico", icon: ClockCounterClockwiseIcon, onSelect: () => setHistory("open") },
        ...(project.status === "active"
          ? [
              { id: "pause", label: "Pausar", icon: PauseCircleIcon, onSelect: () => void setStatus("paused", "Projeto pausado") },
              { id: "finish", label: "Marcar como concluído", icon: CheckCircleIcon, onSelect: () => void setStatus("done", "Projeto concluído") },
            ]
          : []),
        ...(project.status === "paused" ? [{ id: "resume", label: "Retomar", icon: PlayCircleIcon, onSelect: () => void setStatus("active", "Projeto retomado") }] : []),
        ...(project.status === "done" ? [{ id: "reopen", label: "Reabrir", icon: PlayCircleIcon, onSelect: () => void setStatus("active", "Projeto reaberto") }] : []),
      ],
    },
    {
      id: "danger",
      items: [{ id: "delete", label: "Excluir", icon: TrashIcon, tone: "danger", onSelect: onDelete }],
    },
  ];

  return (
    <>
      <DropdownMenu label={`Opções de ${project.reference}`} triggerLabel={`Mais opções de ${project.name}`} sections={sections} />
      {history !== "never" && (
        <HistoryDialog open={history === "open"} onClose={() => setHistory("closed")} recordType="project" recordId={project.id} name={project.name} />
      )}
    </>
  );
}
