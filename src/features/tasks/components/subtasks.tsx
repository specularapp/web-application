"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarBlankIcon, CalendarPlusIcon, DotsSixVerticalIcon, FlagIcon, PlusIcon, UserCirclePlusIcon, XIcon } from "@phosphor-icons/react";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/providers/toast-provider";
import { changeTask } from "../changes";
import { priorityLabels, priorityTones } from "../labels";
import type { Subtask, TaskPerson, TaskPriority } from "../summary";
import { SubtaskDialog } from "./task-add-dialogs";
import { priorityMark } from "./priority-mark";
import styles from "./task-sheet.module.css";
import { randomId } from "@/lib/utils/id";

export type SubtasksProps = {
  /** A tarefa dona da lista, para cada mudança gravar nela. */
  taskId: string;
  subtasks: Subtask[];
  /** Quem pode assumir uma subtarefa; vazio deixa o atribuir de responsável de fora. */
  team?: TaskPerson[];
  /** A lista como está agora, para a ficha e o cartão contarem o progresso junto. */
  onChange?: (subtasks: Subtask[]) => void;
  /** Avisa que uma mudança foi gravada, para a atividade da ficha reler as notas. */
  onSaved?: () => void;
};

/* Os prazos que o menu oferece, em dias a partir de hoje: cobrem o que se escolhe de verdade numa
   subtarefa, sem abrir um calendário inteiro para uma linha de lista. */
const deadlineChoices: { id: string; label: string; days: number | null }[] = [
  { id: "today", label: "Hoje", days: 0 },
  { id: "tomorrow", label: "Amanhã", days: 1 },
  { id: "week", label: "Em 7 dias", days: 7 },
  { id: "month", label: "Em 30 dias", days: 30 },
  { id: "none", label: "Sem prazo", days: null },
];

const priorities: TaskPriority[] = ["low", "normal", "high", "urgent"];

const shortDate = (iso: string) => format(parseISO(iso), "d MMM.", { locale: ptBR });
const isoDay = (days: number) => format(addDays(new Date(), days), "yyyy-MM-dd");


// As subtarefas com a caixa da casa para marcar e desmarcar, e cada uma com **três atribuições separadas na
// ponta da linha** (2026-09-10, a pedido): quem assume, o prazo e a prioridade, cada uma no próprio menu.
// Vazia, a atribuição é só o glifo apagado, que é o convite para atribuir; preenchida, ela é o valor — o
// rosto, a data em etiqueta, a prioridade em etiqueta. É a mesma regra da ficha da tarefa: o valor continua
// sendo o valor, e é o clique nele que abre as opções.
//
// Um menu só com três seções durou uma rodada e saiu: escondia atrás de um chevron três coisas que a pessoa
// precisa ver atribuídas ou não de relance. Quem escolhe pessoa vê o rosto e o nome; o prazo é uma lista de
// escolhas ("Hoje", "Amanhã", "Em 7 dias") em vez de um calendário, porque numa linha de lista é o que se
// escolhe de verdade.
//
// Acrescentar mora no cabeçalho, só em glifo, e abre a janela da casa com título, responsável, prioridade e
// prazo. Cada mudança aparece na hora e grava no banco por trás (2026-09-22); se o banco recusar, a linha
// volta ao que era e o aviso diz por quê.
export function Subtasks({ taskId, subtasks, team = [], onChange, onSaved }: SubtasksProps) {
  const { toast } = useToast();
  const [items, setItems] = useState(subtasks);

  useEffect(() => {
    onChange?.(items);
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const [adding, setAdding] = useState(false);

  const done = items.filter((item) => item.done).length;

  const failed = (error: string) => toast({ title: "Não deu para salvar a subtarefa", description: error, tone: "danger" });

  const patch = (id: string, change: Partial<Subtask>) => {
    const before = items;
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)));
    void changeTask(taskId, {
      op: "subtask-update",
      id,
      ...("done" in change && { done: change.done }),
      ...("title" in change && { title: change.title }),
      ...("person" in change && { assigneeId: change.person?.id ?? null }),
      ...("priority" in change && { priority: change.priority ?? null }),
      ...("dueDate" in change && { dueDate: change.dueDate ?? null }),
    }).then((result) => {
      if (result.ok) return onSaved?.();
      setItems(before);
      failed(result.error);
    });
  };

  /* A subtarefa aberta para ver e editar, pelo id. */
  const [editing, setEditing] = useState<string | null>(null);
  const opened = items.find((item) => item.id === editing) ?? null;

  const dragId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** Arrastar muda a ordem na hora e grava a lista inteira; recusada, a lista volta ao que era. */
  const reorder = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;
    const before = items;
    const next = arrayMove(items, from, to);
    setItems(next);
    void changeTask(taskId, { op: "subtask-order", ids: next.map((item) => item.id) }).then((result) => {
      if (result.ok) return onSaved?.();
      setItems(before);
      failed(result.error);
    });
  };

  const remove = (id: string) => {
    const before = items;
    setItems((current) => current.filter((item) => item.id !== id));
    void changeTask(taskId, { op: "subtask-remove", id }).then((result) => {
      if (result.ok) return onSaved?.();
      setItems(before);
      failed(result.error);
    });
  };

  const add = (subtask: Omit<Subtask, "id">) => {
    const id = randomId();
    setItems((current) => [...current, { ...subtask, id }]);
    void changeTask(taskId, {
      op: "subtask-add",
      id,
      title: subtask.title,
      assigneeId: subtask.person?.id ?? null,
      priority: subtask.priority ?? null,
      dueDate: subtask.dueDate ?? null,
    }).then((result) => {
      if (result.ok) return onSaved?.();
      setItems((current) => current.filter((item) => item.id !== id));
      failed(result.error);
    });
  };

  const ownerSections = (item: Subtask): DropdownSection[] => [
    {
      id: "owner",
      label: "Quem assume",
      items: [
        ...team.map((person) => ({
          id: `owner-${person.name}`,
          label: person.name,
          media: <Avatar name={person.name} src={person.avatarUrl ?? undefined} size="xs" />,
          selected: item.person?.name === person.name,
          onSelect: () => patch(item.id, { person }),
        })),
        ...(item.person ? [{ id: "owner-none", label: "Sem responsável", icon: XIcon, onSelect: () => patch(item.id, { person: undefined }) }] : []),
      ],
    },
  ];

  const deadlineSections = (item: Subtask): DropdownSection[] => [
    {
      id: "deadline",
      label: "Prazo",
      items: deadlineChoices.map((choice) => ({
        id: `deadline-${choice.id}`,
        label: choice.label,
        icon: choice.days === null ? XIcon : CalendarBlankIcon,
        selected: choice.days === null ? !item.dueDate : item.dueDate === isoDay(choice.days),
        onSelect: () => patch(item.id, { dueDate: choice.days === null ? undefined : isoDay(choice.days) }),
      })),
    },
  ];

  const prioritySections = (item: Subtask): DropdownSection[] => [
    {
      id: "priority",
      label: "Prioridade",
      items: [
        ...priorities.map((priority) => ({
          id: `priority-${priority}`,
          label: priorityLabels[priority],
          media: priorityMark(priority),
          selected: item.priority === priority,
          onSelect: () => patch(item.id, { priority }),
        })),
        ...(item.priority ? [{ id: "priority-none", label: "Sem prioridade", icon: XIcon, onSelect: () => patch(item.id, { priority: undefined }) }] : []),
      ],
    },
  ];

  return (
    <section className={styles.block}>
      <div className={styles.blockInner}>
        <div className={styles.blockHead}>
          <span className={styles.blockTitle}>
            <Text as="h3" variant="callout" weight="semibold">
              Subtarefas
            </Text>
            {items.length > 0 && (
              <span className={styles.count}>
                <Text as="span" variant="footnote" tone="secondary">
                  {done} de {items.length}
                </Text>
                <Progress value={done} max={items.length} segments={items.length} size="xs" tone="success" className={styles.progress} />
              </span>
            )}
          </span>
          <IconButton label="Adicionar subtarefa" variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <PlusIcon />
          </IconButton>
        </div>

        {items.length === 0 ? (
          <div className={styles.blockEmpty}>
            <Text variant="footnote" tone="tertiary">
              Nenhuma subtarefa. Quebre o trabalho em passos.
            </Text>
          </div>
        ) : (
          <DndContext
            id={dragId}
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={reorder}
            accessibility={{
              screenReaderInstructions: {
                draggable: "Aperte espaço para pegar a subtarefa, use as setas para mudar de lugar e espaço para soltar. Esc cancela.",
              },
              announcements: {
                onDragStart: () => "Subtarefa pega para mudar de lugar",
                onDragOver: () => "Mudando de lugar",
                onDragEnd: () => "Subtarefa no lugar novo",
                onDragCancel: () => "Subtarefa ficou onde estava",
              },
            }}
          >
            <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <ul className={styles.list}>
                {items.map((item) => (
                  <SortableSubtask key={item.id} id={item.id} done={item.done} title={item.title}>
                    <Checkbox
                      checked={item.done}
                      onChange={() => patch(item.id, { done: !item.done })}
                      aria-label={item.done ? `Reabrir ${item.title}` : `Concluir ${item.title}`}
                      className={styles.check}
                    />
                    {/* O título numa linha só, com reticências, e o toque nele abre a subtarefa para ver e editar. */}
                    <button type="button" className={styles.subtaskTitle} title={item.title} onClick={() => setEditing(item.id)}>
                      {item.title}
                    </button>
    
                    {/* As três atribuições, sempre na mesma ordem: prioridade, prazo e quem assume. Cada uma é o
                        glifo apagado enquanto está vazia e o valor depois de atribuída. */}
                    <span className={styles.assigns}>
                      <DropdownMenu
                        label={`Prioridade de ${item.title}`}
                        triggerLabel={item.priority ? `Prioridade: ${priorityLabels[item.priority]}. Trocar` : `Atribuir prioridade a ${item.title}`}
                        sections={prioritySections(item)}
                        triggerContent={
                          item.priority ? (
                            <Badge tone={priorityTones[item.priority]} size="sm" icon={<FlagIcon />}>
                              {priorityLabels[item.priority]}
                            </Badge>
                          ) : (
                            <FlagIcon aria-hidden="true" className={styles.assign} />
                          )
                        }
                      />
    
                      <DropdownMenu
                        label={`Prazo de ${item.title}`}
                        triggerLabel={item.dueDate ? `Prazo: ${shortDate(item.dueDate)}. Trocar` : `Atribuir prazo a ${item.title}`}
                        sections={deadlineSections(item)}
                        triggerContent={
                          item.dueDate ? (
                            <Badge size="sm" icon={<CalendarBlankIcon />}>
                              {shortDate(item.dueDate)}
                            </Badge>
                          ) : (
                            <CalendarPlusIcon aria-hidden="true" className={styles.assign} />
                          )
                        }
                      />
    
                      {team.length > 0 && (
                        <DropdownMenu
                          label={`Responsável por ${item.title}`}
                          triggerLabel={item.person ? `Responsável: ${item.person.name}. Trocar` : `Atribuir responsável a ${item.title}`}
                          sections={ownerSections(item)}
                          triggerContent={
                            item.person ? (
                              <Avatar name={item.person.name} src={item.person.avatarUrl ?? undefined} size="xs" />
                            ) : (
                              <UserCirclePlusIcon aria-hidden="true" className={styles.assign} />
                            )
                          }
                        />
                      )}
                    </span>
                  </SortableSubtask>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <SubtaskDialog
        open={adding}
        onClose={() => setAdding(false)}
        team={team}
        onAdd={add}
      />
      {/* A mesma janela, com a subtarefa dentro: a chave remonta os campos para cada subtarefa aberta. */}
      {opened && (
        <SubtaskDialog
          key={opened.id}
          open
          subtask={opened}
          team={team}
          onClose={() => setEditing(null)}
          onAdd={(changes) => {
            patch(opened.id, { title: changes.title, person: changes.person, priority: changes.priority, dueDate: changes.dueDate });
            setEditing(null);
          }}
          onRemove={() => {
            remove(opened.id);
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

/** Uma subtarefa que se arrasta pela alça da frente; o resto da linha segue respondendo ao toque. */
function SortableSubtask({ id, done, title, children }: { id: string; done: boolean; title: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      className={styles.subtask}
      data-done={done || undefined}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <IconButton
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        label={`Arrastar ${title} para mudar de lugar`}
        variant="ghost"
        size="sm"
        className={styles.handle}
      >
        <DotsSixVerticalIcon />
      </IconButton>
      {children}
    </li>
  );
}
