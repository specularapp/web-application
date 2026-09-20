"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ArrowsInLineHorizontalIcon, ArrowsOutLineHorizontalIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { compactMoney, formatMoney } from "@/lib/utils/format";
import { squircle } from "@/lib/corners";
import { totalValue } from "../labels";
import { crmSortIcons, crmSortLabels, crmSortValues, type CrmColumnSort } from "../list-options";
import type { CrmStage, CrmStageMeta } from "../stages";
import type { Opportunity } from "../summary";
import { OpportunityCard } from "./opportunity-card";
import styles from "./opportunity-column.module.css";

export type OpportunityColumnProps = {
  stage: CrmStageMeta;
  /** As oportunidades da etapa, já filtradas e na ordem que a coluna escolheu. */
  opportunities: Opportunity[];
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  sort: CrmColumnSort;
  onSortChange: (sort: CrmColumnSort) => void;
  /** Abre a oportunidade na ficha completa, que é uma só para o quadro inteiro. */
  onOpen: (opportunity: Opportunity) => void;
  /** Cria uma oportunidade nesta etapa. */
  onAdd: () => void;
  /** Onde o cartão que está sendo arrastado vai cair, quando é aqui: a coluna acende e abre o lugar dele. */
  landing?: boolean;
  /** Se o cartão desta coluna se pega com o dedo: no celular não, porque o mesmo gesto passaria de etapa. */
  draggable?: boolean;
  /** As etapas deste quadro, para o "Mover para" do leque do cartão oferecer só as que existem aqui. */
  stages?: CrmStage[];
  onMove?: (opportunity: Opportunity, stage: CrmStage) => void;
  /** Pede a exclusão de uma oportunidade; quem confirma é o quadro. */
  onDelete?: (opportunity: Opportunity) => void;
  /** Tira esta etapa do funil; ausente no quadro de todas as oportunidades, que não tem dono. */
  onRemoveStage?: () => void;
};

function DraggableCard({
  opportunity,
  stage,
  onOpen,
  stages,
  onMove,
  onDelete,
}: {
  opportunity: Opportunity;
  stage: CrmStage;
  onOpen: () => void;
  stages?: CrmStage[];
  onMove?: (opportunity: Opportunity, stage: CrmStage) => void;
  onDelete?: (opportunity: Opportunity) => void;
}) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: opportunity.id,
    data: { opportunity, stage },
    attributes: { roleDescription: "cartão de oportunidade" },
  });

  return (
    <OpportunityCard
      opportunity={opportunity}
      onOpen={onOpen}
      drag={{ ref: setNodeRef, listeners, attributes, dragging: isDragging }}
      stages={stages}
      onMove={onMove && ((to) => onMove(opportunity, to))}
      onDelete={onDelete && (() => onDelete(opportunity))}
    />
  );
}

// Uma coluna do funil, no mesmo desenho da coluna do quadro de tarefas: à esquerda a etiqueta da etapa numa
// pílula só, com o glifo, o nome e a contagem dentro dela; à direita o chevron duplo com o que se faz com
// uma etapa e o "+" que cria aqui. Embaixo, a pilha de cartões, que rola por dentro.
//
// O que o funil acrescenta é o **dinheiro da coluna**, na mesma linha da etiqueta: num quadro de vendas a
// pergunta da etapa não é só "quantas", é "quanto tem parado aqui", e essa resposta não cabe na contagem.
export function OpportunityColumn({
  stage,
  opportunities,
  collapsed,
  onCollapsedChange,
  sort,
  onSortChange,
  onOpen,
  onAdd,
  landing = false,
  draggable = true,
  stages,
  onMove,
  onDelete,
  onRemoveStage,
}: OpportunityColumnProps) {
  const Glyph = stage.icon;
  const count = opportunities.length;
  const total = totalValue(opportunities);
  const hue = { "--stage-hue": stage.hue } as CSSProperties;
  /* A coluna inteira é o alvo de soltar, cabeçalho incluído: mirar a pilha de uma etapa vazia seria pedir
     precisão que ninguém tem com o cartão na mão. */
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { stage: stage.id } });

  const sections: DropdownSection[] = [
    {
      id: "sort",
      label: "Ordenar por",
      items: crmSortValues.map((value) => ({
        id: `sort-${value}`,
        label: crmSortLabels[value],
        icon: crmSortIcons[value],
        selected: sort === value,
        keepOpen: true,
        onSelect: () => onSortChange(value),
      })),
    },
    {
      id: "stage",
      label: "Etapa",
      items: [
        {
          id: "collapse",
          label: collapsed ? "Expandir etapa" : "Recolher etapa",
          icon: collapsed ? ArrowsOutLineHorizontalIcon : ArrowsInLineHorizontalIcon,
          onSelect: () => onCollapsedChange(!collapsed),
        },
      ],
    },
    ...(onRemoveStage ? [{ id: "remove", items: [{ id: "delete", label: "Tirar etapa do funil", icon: TrashIcon, tone: "danger" as const, onSelect: onRemoveStage }] }] : []),
  ];

  return (
    <section
      ref={setNodeRef}
      className={styles.column}
      style={hue}
      data-collapsed={collapsed || undefined}
      data-landing={landing || undefined}
      data-over={isOver || undefined}
      aria-label={`${stage.label}, ${count} oportunidades`}
    >
      <header className={styles.head}>
        <div className={styles.heading}>
          {/* A etiqueta **é o botão** que abre e fecha a etapa: com a coluna vazia nascendo fechada, tocar o
              cabeçalho é o caminho curto para abri-la, e o menu ficou sendo o longo. */}
          <h2 className={styles.title}>
            <button
              type="button"
              className={styles.stage}
              style={hue}
              aria-expanded={!collapsed}
              onClick={() => onCollapsedChange(!collapsed)}
              {...squircle("md", { clip: true })}
            >
              <Glyph aria-hidden="true" className={styles.glyph} weight="bold" />
              <span className={styles.name}>{stage.label}</span>
              <span className={styles.count} aria-hidden="true" {...squircle("sm", { clip: true })}>
                {count}
              </span>
              <VisuallyHidden>
                {count === 1 ? "1 oportunidade" : `${count} oportunidades`}. {collapsed ? "Abrir etapa" : "Recolher etapa"}
              </VisuallyHidden>
            </button>
          </h2>

          {/* O dinheiro da etapa **na mesma linha** do nome dela (a pedido, 2026-09-15), em número curto e
              com o valor cheio na dica: embaixo ele abria uma segunda faixa no cabeçalho e empurrava a pilha
              para baixo em todas as sete colunas. Some com a coluna recolhida, onde não há largura para
              número nenhum. */}
          {!collapsed && count > 0 && (
            <Text as="span" variant="caption1" tone="secondary" className={styles.total} title={formatMoney(total)}>
              {compactMoney(total)}
            </Text>
          )}
        </div>

        {/* As ações só existem com a etapa aberta: recolhida, quem abre é o próprio cabeçalho. */}
        {!collapsed && (
          <div className={styles.tools}>
            <DropdownMenu label={`Opções da etapa ${stage.label}`} triggerLabel={`Opções da etapa ${stage.label}`} sections={sections} size="sm" />
            <IconButton label={`Nova oportunidade em ${stage.label}`} variant="ghost" size="sm" onClick={onAdd}>
              <PlusIcon />
            </IconButton>
          </div>
        )}
      </header>

      {!collapsed &&
        (count === 0 && !landing ? (
          <div className={styles.empty}>
            <Text variant="footnote" tone="tertiary">
              Nada nesta etapa
            </Text>
          </div>
        ) : (
          <div className={styles.body}>
            <ul className={styles.list}>
              {/* O lugar do cartão que vem: tracejado no matiz da etapa, no topo da pilha, que é a parte da
                  coluna que está à vista quando o cartão chega. */}
              {landing && (
                <li className={styles.landing} aria-hidden="true" {...squircle("xl")}>
                  <Text as="span" variant="caption1" weight="medium" tone="inherit">
                    Soltar em {stage.label}
                  </Text>
                </li>
              )}
              {opportunities.map((opportunity) =>
                draggable ? (
                  <DraggableCard
                    key={opportunity.id}
                    opportunity={opportunity}
                    stage={stage.id}
                    onOpen={() => onOpen(opportunity)}
                    stages={stages}
                    onMove={onMove}
                  />
                ) : (
                  <OpportunityCard
                    key={opportunity.id}
                    opportunity={opportunity}
                    onOpen={() => onOpen(opportunity)}
                    stages={stages}
                    onMove={onMove && ((to) => onMove(opportunity, to))}
                    onDelete={onDelete && (() => onDelete(opportunity))}
                  />
                ),
              )}
            </ul>
          </div>
        ))}
    </section>
  );
}
