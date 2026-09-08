"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import styled from "@emotion/styled";
import { DotsSixVerticalIcon } from "@phosphor-icons/react";
import { focusRing, hoverMotion } from "@/components/ui/styles";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { dashboardBlocks, type DashboardBlock, type DashboardBlockId } from "../blocks";

export type DashboardBlocksListProps = {
  order: DashboardBlockId[];
  hidden: DashboardBlockId[];
  /** A ordem nova inteira, já com o bloco no lugar onde foi solto. */
  onReorder: (order: DashboardBlockId[]) => void;
  onToggle: (id: DashboardBlockId, visible: boolean) => void;
};

const List = styled.ol`
  display: grid;
  gap: var(--space-1);
  padding: 0;
  margin: 0;
  list-style: none;
`;

/* Cada bloco é uma linha do menu: a alça de arrastar, o ícone e o nome do bloco, e o interruptor de
   mostrar na ponta. Arrastando, a linha sobe um degrau e ganha o preenchimento da casa. */
const Row = styled.li`
  display: flex;
  gap: var(--space-2);
  align-items: center;
  min-height: 2.75rem;
  padding: var(--space-1) var(--space-2);
  color: var(--color-label);
  border-radius: var(--radius-md);
  corner-shape: squircle;
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard);

  &[data-dragging] {
    z-index: 1;
    background-color: var(--color-fill-quaternary);
    box-shadow: var(--shadow-md);
  }

  &[data-hidden] {
    color: var(--color-label-secondary);
  }

  & > svg {
    flex-shrink: 0;
    width: 1.125rem;
    height: 1.125rem;
  }
`;

const Handle = styled.button`
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  color: var(--color-label-tertiary);
  cursor: grab;
  touch-action: none;
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  ${hoverMotion};
  ${focusRing};

  @media (hover: hover) {
    &:hover {
      color: var(--color-label);
      background-color: var(--color-fill-quaternary);
    }
  }

  &:active {
    cursor: grabbing;
  }

  & svg {
    width: 1rem;
    height: 1rem;
  }
`;

const Name = styled(Text)`
  flex: 1;
  min-width: 0;
`;

type SortableRowProps = { block: DashboardBlock; hidden: boolean; onToggle: (visible: boolean) => void };

function SortableRow({ block, hidden, onToggle }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  return (
    <Row
      ref={setNodeRef}
      data-dragging={isDragging || undefined}
      data-hidden={hidden || undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <Handle ref={setActivatorNodeRef} type="button" aria-label={`Arrastar ${block.title}`} {...attributes} {...listeners}>
        <DotsSixVerticalIcon weight="bold" />
      </Handle>
      <block.icon aria-hidden="true" />
      <Name as="span" variant="subheadline" weight="medium" truncate>
        {block.title}
      </Name>
      <Switch size="sm" checked={!hidden} onChange={(event) => onToggle(event.target.checked)} aria-label={`Mostrar ${block.title}`} />
    </Row>
  );
}

// A lista de blocos que arrasta e liga, separada da gaveta de propósito (varredura de peso de
// 2026-09-08): o `@dnd-kit` são 56 KB comprimidos, e no topo do arquivo da gaveta eles viajavam em toda
// carga do painel para uma gaveta que nasce fechada. Aqui eles entram por importação dinâmica e só
// chegam quando a engrenagem é apertada. A `Dialog` não renderiza o conteúdo enquanto está fechada,
// então basta o módulo estar de fora.
export function DashboardBlocksList({ order, hidden, onReorder, onToggle }: DashboardBlocksListProps) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const blocksById = new Map(dashboardBlocks.map((block) => [block.id, block]));
  const ordered = order.map((id) => blocksById.get(id)).filter((block): block is DashboardBlock => Boolean(block));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = order.indexOf(active.id as DashboardBlockId);
    const to = order.indexOf(over.id as DashboardBlockId);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(order, from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <List aria-label="Blocos do painel, na ordem da grade">
          {ordered.map((block) => (
            <SortableRow key={block.id} block={block} hidden={hidden.includes(block.id)} onToggle={(visible) => onToggle(block.id, visible)} />
          ))}
        </List>
      </SortableContext>
    </DndContext>
  );
}
