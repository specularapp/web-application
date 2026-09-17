"use client";

import {
  ArrowSquareOutIcon,
  CopySimpleIcon,
  HashIcon,
  ProhibitIcon,
  ReceiptIcon,
  TrashIcon,
  TrophyIcon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/providers/toast-provider";
import { duplicateOpportunityAction } from "../actions";
import { statusOf } from "../labels";
import { crmStageMeta, type CrmStage } from "../stages";
import type { Opportunity } from "../summary";

export type OpportunityMenuProps = {
  opportunity: Opportunity;
  /** Abre a ficha completa, a mesma que o cartão abre no clique. */
  onOpen?: () => void;
  /** As etapas do quadro onde a oportunidade está: são elas que "Mover para" oferece. */
  stages?: CrmStage[];
  /** Leva a oportunidade para outra etapa. Sem isto, a seção de mover não aparece. */
  onMove?: (stage: CrmStage) => void;
  /** Pede a exclusão; quem confirma é a janela da casa, com a pergunta e o aviso. */
  onDelete?: () => void;
};

// As opções de uma oportunidade, no padrão do menu da tarefa, do cliente e do orçamento: abrir a ficha,
// copiar o identificador, mover de etapa, ver ou gerar o orçamento, duplicar, e os dois desfechos antes do
// excluir. Não há "Editar": a ficha da oportunidade **é** o editor, então abrir e editar seriam a mesma
// linha escrita duas vezes.
//
// Ganhar e perder são **ações de menu**, e não só etapas de coluna: fechar uma venda é a coisa mais decisiva
// que se faz com ela, e pedir que a pessoa arraste o cartão até a última coluna para isso seria esconder o
// que o funil existe para fazer. Cada uma só aparece enquanto ainda não é o caso.
export function OpportunityMenu({ opportunity, onOpen, stages, onMove, onDelete }: OpportunityMenuProps) {
  const router = useRouter();
  const { toast } = useToast();
  const status = statusOf(opportunity);

  const duplicate = async () => {
    const result = await duplicateOpportunityAction(opportunity.id);
    if (!result.ok) {
      toast({ title: "Não deu para duplicar", description: result.error, tone: "danger" });
      return;
    }
    toast({ title: "Oportunidade duplicada", description: "A cópia entrou em aberto, na primeira etapa.", tone: "success" });
    router.refresh();
  };

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(opportunity.reference);
      toast({ title: "Identificador copiado", description: `${opportunity.reference} está na área de transferência.`, tone: "success" });
    } catch {
      toast({ title: "Não deu para copiar", description: opportunity.reference, tone: "warning" });
    }
  };

  /** As opções são as etapas **deste quadro**, e não as do catálogo: mandar a venda para uma etapa que o
   *  funil não tem a deixaria sem coluna onde cair. */
  const moveSection: DropdownSection[] =
    onMove && stages && stages.length > 1
      ? [
          {
            id: "move",
            label: "Mover para",
            items: stages.map((id) => {
              const meta = crmStageMeta[id];
              const Glyph = meta.icon;
              return {
                id: `move-${id}`,
                label: meta.label,
                media: <Glyph weight="bold" style={{ color: meta.hue } as CSSProperties} />,
                selected: opportunity.stage === id,
                onSelect: () => onMove(id),
              };
            }),
          },
        ]
      : [];

  const closing = [
    ...(status === "won" || !stages?.includes("won")
      ? []
      : [{ id: "won", label: "Marcar como ganha", icon: TrophyIcon, onSelect: () => onMove?.("won") }]),
    ...(status === "lost" || !stages?.includes("lost")
      ? []
      : [{ id: "lost", label: "Marcar como perdida", icon: ProhibitIcon, onSelect: () => onMove?.("lost") }]),
  ];

  const sections: DropdownSection[] = [
    {
      id: "actions",
      items: [
        ...(onOpen ? [{ id: "open", label: "Abrir oportunidade", icon: ArrowSquareOutIcon, onSelect: onOpen }] : []),
        { id: "copy", label: "Copiar identificador", icon: HashIcon, onSelect: () => void copyReference() },
      ],
    },
    ...moveSection,
    {
      id: "more",
      items: [
        {
          id: "quote",
          label: opportunity.quote ? "Ver orçamento" : "Gerar orçamento",
          icon: ReceiptIcon,
          submenu: true,
          href: (opportunity.quote
            ? `/orcamentos/${opportunity.quote.id}`
            : `/orcamentos/novo?cliente=${opportunity.client.id}`) as Route,
        },
        { id: "duplicate", label: "Duplicar", icon: CopySimpleIcon, onSelect: () => void duplicate() },
      ],
    },
    ...(closing.length > 0 ? [{ id: "closing", items: closing }] : []),
    ...(onDelete
      ? [{ id: "danger", items: [{ id: "delete", label: "Excluir", icon: TrashIcon, tone: "danger" as const, onSelect: onDelete }] }]
      : []),
  ];

  return (
    <DropdownMenu
      label={`Opções de ${opportunity.reference}`}
      triggerLabel={`Mais opções de ${opportunity.title}`}
      sections={sections}
      size="sm"
    />
  );
}
