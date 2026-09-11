"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ArrowsInLineHorizontalIcon, ArrowsOutLineHorizontalIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { squircle } from "@/lib/corners";
import { columnSortIcons, columnSortLabels, columnSortValues, type TasksColumnSort } from "../list-options";
import type { TaskStage, TaskStageMeta } from "../stages";
import type { Task } from "../summary";
import { TaskCard } from "./task-card";
import styles from "./task-column.module.css";

export type TaskColumnProps = {
  stage: TaskStageMeta;
  /** As tarefas da etapa, já filtradas e na ordem que a coluna escolheu. */
  tasks: Task[];
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  sort: TasksColumnSort;
  onSortChange: (sort: TasksColumnSort) => void;
  /** Abre a tarefa na ficha completa, que é uma só para o quadro inteiro. */
  onOpen: (task: Task) => void;
  /** Cria uma tarefa nesta etapa. */
  onAdd: () => void;
  /**
   * Onde o cartão que está sendo arrastado vai cair, quando é aqui (2026-09-10): a coluna acende e abre o
   * lugar dele no fim da pilha. Vem de fora porque quem sabe disso é o quadro, que conhece as duas pontas do
   * gesto; a coluna só desenha.
   */
  landing?: boolean;
  /**
   * Se o cartão desta coluna se pega com o dedo (2026-09-11): no celular não, porque o mesmo gesto passaria
   * de etapa, e quem move ali é a ficha e o "Mover para" do leque. Sem o arraste o cartão nem chega a ser
   * medido pelo `useDraggable`, então não sobra ouvinte de toque no caminho da rolagem.
   */
  draggable?: boolean;
  /** As etapas deste quadro, para o "Mover para" do leque do cartão oferecer só as que existem aqui. */
  stages?: TaskStage[];
  /** Leva a tarefa para outra etapa, pelo leque do cartão. */
  onMove?: (task: Task, stage: TaskStage) => void;
};

// Uma coluna do quadro. O cabeçalho é o que esta rodada acertou (2026-09-10, a pedido, sobre uma referência
// do usuário): à esquerda a etiqueta da etapa numa pílula só, com o glifo, o nome e a contagem de tarefas
// **dentro** dela; à direita o chevron duplo da casa, que abre o menu com o que se faz com uma etapa, e o
// "+" que cria uma tarefa aqui. Embaixo, a pilha de cartões, que rola por dentro.
//
// Recolhida, a coluna vira um trilho estreito: a mesma pílula em pé, com o nome na vertical e a contagem,
// e o menu no pé, por onde ela volta a abrir. É a mesma marcação, só de lado, então não existe um segundo
// cabeçalho para sair de sincronia com este.
function DraggableCard({
  task,
  stage,
  onOpen,
  stages,
  onMove,
}: {
  task: Task;
  stage: TaskStage;
  onOpen: () => void;
  stages?: TaskStage[];
  onMove?: (task: Task, stage: TaskStage) => void;
}) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: task.id,
    data: { task, stage },
    attributes: { roleDescription: "cartão de tarefa" },
  });

  return (
    <TaskCard
      task={task}
      onOpen={onOpen}
      drag={{ ref: setNodeRef, listeners, attributes, dragging: isDragging }}
      stages={stages}
      onMove={onMove && ((to) => onMove(task, to))}
    />
  );
}

export function TaskColumn({
  stage,
  tasks,
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
}: TaskColumnProps) {
  const Glyph = stage.icon;
  const count = tasks.length;
  const hue = { "--stage-hue": stage.hue } as CSSProperties;
  /* A coluna inteira é o alvo de soltar, cabeçalho incluído: mirar a pilha de uma etapa vazia, que é uma
     frase de cinco linhas de altura, seria pedir precisão que ninguém tem com o cartão na mão. */
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { stage: stage.id } });

  /* O menu do chevron duplo: a ordem de dentro da coluna, que vale na hora e não fecha o menu (a pessoa
     costuma experimentar mais de uma), e o que se faz com a etapa em si. Recolher funciona e fica no cookie;
     renomear e excluir só fecham o menu enquanto as etapas são uma lista fixa em código, e passam a valer
     quando a tabela nascer. */
  const sections: DropdownSection[] = [
    {
      id: "sort",
      label: "Ordenar por",
      items: columnSortValues.map((value) => ({
        id: `sort-${value}`,
        label: columnSortLabels[value],
        icon: columnSortIcons[value],
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
        { id: "rename", label: "Renomear etapa", icon: PencilSimpleIcon },
      ],
    },
    { id: "remove", items: [{ id: "delete", label: "Excluir etapa", icon: TrashIcon, tone: "danger" }] },
  ];

  return (
    <section
      ref={setNodeRef}
      className={styles.column}
      style={hue}
      data-collapsed={collapsed || undefined}
      data-landing={landing || undefined}
      data-over={isOver || undefined}
      aria-label={`${stage.label}, ${count} tarefas`}
    >
      <header className={styles.head}>
        {/* A etiqueta **é o botão** que abre e fecha a etapa (2026-09-10, a pedido): com a coluna vazia
            nascendo fechada, tocar o cabeçalho é o caminho curto para abri-la, e o menu ficou sendo o longo.
            Ela é montada aqui, e não com o `Badge` da casa: o primitivo não tem lugar para um chip no fim, e
            a contagem precisa ficar dentro. As contas de tinta e de véu são as dele, e o canto sai do sistema
            de cantos: `md` na etiqueta e o concêntrico `sm` na contagem. */}
        <h2 className={styles.heading}>
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
              {count === 1 ? "1 tarefa" : `${count} tarefas`}. {collapsed ? "Abrir etapa" : "Recolher etapa"}
            </VisuallyHidden>
          </button>
        </h2>

        {/* As ações só existem com a etapa aberta: recolhida, quem abre é o próprio cabeçalho. */}
        {!collapsed && (
          <div className={styles.tools}>
            <DropdownMenu label={`Opções da etapa ${stage.label}`} triggerLabel={`Opções da etapa ${stage.label}`} sections={sections} size="sm" />
            <IconButton label={`Nova tarefa em ${stage.label}`} variant="ghost" size="sm" onClick={onAdd}>
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
              {/* O lugar do cartão que vem: tracejado no matiz da etapa, **no topo** da pilha, que é a parte
                  da coluna que está à vista quando o cartão chega; no fim ele ficava fora da tela numa
                  coluna cheia, e o aviso não avisava nada. A ordem de dentro segue sendo a da coluna, então
                  o lugar aqui é o do anúncio, e não o da fila. */}
              {landing && (
                <li className={styles.landing} aria-hidden="true" {...squircle("xl")}>
                  <Text as="span" variant="caption1" weight="medium" tone="inherit">
                    Soltar em {stage.label}
                  </Text>
                </li>
              )}
              {tasks.map((task) =>
                draggable ? (
                  <DraggableCard
                    key={task.id}
                    task={task}
                    stage={stage.id}
                    onOpen={() => onOpen(task)}
                    stages={stages}
                    onMove={onMove}
                  />
                ) : (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onOpen={() => onOpen(task)}
                    stages={stages}
                    onMove={onMove && ((to) => onMove(task, to))}
                  />
                ),
              )}
            </ul>
          </div>
        ))}
    </section>
  );
}
