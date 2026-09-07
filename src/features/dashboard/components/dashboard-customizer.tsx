"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import styled from "@emotion/styled";
import { DotsSixVerticalIcon, GearSixIcon, XIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { focusRing, hoverMotion } from "@/components/ui/styles";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { dashboardBlocks, type DashboardBlock, type DashboardBlockId } from "../blocks";
import { saveDashboardLayout, type DashboardLayout } from "../layout";

export type DashboardCustomizerProps = { layout: DashboardLayout };

const Drawer = styled(Dialog)`
  --panel-line: 0.0375rem;
`;

const Header = styled.header`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border-block-end: var(--panel-line) solid var(--color-border);
`;

const Close = styled.span`
  flex-shrink: 0;
  margin-inline-start: auto;
`;

const Scroll = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: var(--space-3);
  flex: 1;
  min-height: 0;
  padding: var(--space-4) var(--space-5) var(--space-5);
  overflow-y: auto;
  overscroll-behavior: contain;
`;

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

// A engrenagem do cabeçalho abre a gaveta de personalizar o painel, na moldura da casa: a lista dos
// blocos na ordem da grade, cada um com a alça de arrastar para reordenar (ponteiro ou teclado) e o
// interruptor de mostrar. Cada mudança grava o cookie de preferência e refaz a árvore do servidor, que
// é quem monta a grade a partir dele, então a tela atrás se ajusta enquanto a gaveta está aberta.
export function DashboardCustomizer({ layout }: DashboardCustomizerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(layout);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const blocksById = new Map(dashboardBlocks.map((block) => [block.id, block]));
  const ordered = current.order.map((id) => blocksById.get(id)).filter((block): block is DashboardBlock => Boolean(block));

  const apply = (next: DashboardLayout) => {
    setCurrent(next);
    saveDashboardLayout(next);
    startTransition(() => router.refresh());
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = current.order.indexOf(active.id as DashboardBlockId);
    const to = current.order.indexOf(over.id as DashboardBlockId);
    if (from < 0 || to < 0) return;
    apply({ ...current, order: arrayMove(current.order, from, to) });
  };

  const toggle = (id: DashboardBlockId, visible: boolean) => {
    const hidden = visible ? current.hidden.filter((entry) => entry !== id) : [...current.hidden, id];
    apply({ ...current, hidden });
  };

  return (
    <>
      <IconButton label="Personalizar painel" variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen(true)}>
        <GearSixIcon />
      </IconButton>

      <Drawer open={open} onClose={() => setOpen(false)} label="Personalizar painel" size="sm" placement="end" surface="glass" scrim={false}>
        <Header>
          <Text as="h2" variant="headline" weight="semibold">
            Personalizar painel
          </Text>
          <Close>
            <IconButton label="Fechar" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              <XIcon />
            </IconButton>
          </Close>
        </Header>

        <Scroll>
          <Text variant="footnote" tone="secondary">
            Arraste para mudar a ordem e desligue o que não quer ver. A grade se ajusta na hora.
          </Text>
          <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={onDragEnd}>
            <SortableContext items={current.order} strategy={verticalListSortingStrategy}>
              <List aria-label="Blocos do painel, na ordem da grade">
                {ordered.map((block) => (
                  <SortableRow key={block.id} block={block} hidden={current.hidden.includes(block.id)} onToggle={(visible) => toggle(block.id, visible)} />
                ))}
              </List>
            </SortableContext>
          </DndContext>
        </Scroll>
      </Drawer>
    </>
  );
}
