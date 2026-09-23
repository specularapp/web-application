"use client";

import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { CalendarBlankIcon, ClockCounterClockwiseIcon, FlagIcon, FolderIcon, LinkSimpleIcon, PaperclipIcon, TagIcon, TimerIcon, WarningIcon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { memo, type KeyboardEvent, type MouseEvent, type SyntheticEvent } from "react";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { tagSections } from "@/components/ui/tag-picker";
import { SuccessOverlay } from "@/components/ui/success-mark";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { rounded, roundedAuto } from "@/lib/corners";
import { dueOf, estimateLabel, priorityLabels, priorityTones, subtasksDone } from "../labels";
import type { TaskStage } from "../stages";
import { TASK_MAX_TAGS } from "../schemas";
import { tagHue, taskTagCatalog } from "../tags";
import type { Task, TaskPriority } from "../summary";
import { useCardEdit } from "./card-edit";
import { priorityMark } from "./priority-mark";
import { TaskMenu } from "./task-menu";
import styles from "./task-card.module.css";

export type TaskCardDrag = {
  /** O nó que o arraste mede, no invólucro do cartão. */
  ref: (node: HTMLElement | null) => void;
  /** O que o gesto precisa ouvir, na caixa que a pessoa pega. */
  listeners?: DraggableSyntheticListeners;
  /** O que o leitor de tela precisa saber, na mesma caixa. */
  attributes?: DraggableAttributes;
  dragging?: boolean;
};

export type TaskCardProps = {
  /** A tarefa acabou de ser arrastada para uma etapa que conclui: o cartão mostra o check e depois volta. */
  celebrating?: boolean;
  /** Avisa que o check terminou, para o quadro tirar a marca. */
  onCelebrated?: () => void;
  task: Task;
  /**
   * Abre a ficha. Recebe a tarefa em vez de fechar sobre ela (2026-09-17, na rodada de velocidade): assim
   * quem lista passa **a mesma função** para todos os cartões, e o `memo` daqui embaixo tem o que segurar.
   * Com um `() => abrir(tarefa)` escrito por cartão, a identidade mudava a cada tecla da busca e a lista
   * inteira redesenhava.
   */
  onOpen: (task: Task) => void;
  /**
   * O arraste do quadro (2026-09-10, a pedido): o cartão inteiro é a alça, então quem chama passa o que o
   * `useDraggable` devolveu. Sem isto o cartão é o de sempre, o que é o caso do bloco do painel.
   */
  drag?: TaskCardDrag;
  /** O cartão que flutua sob o ponteiro enquanto se arrasta: é só o desenho, sem alça e sem leque. */
  overlay?: boolean;
  /** As etapas do quadro em que o cartão está, para o "Mover para" do leque. */
  stages?: TaskStage[];
  /** Leva a tarefa para outra etapa pelo leque, que é o caminho curto onde não se arrasta. */
  onMove?: (task: Task, stage: TaskStage) => void;
  /** Pede a exclusão; quem confirma é a janela da casa, com a pergunta e o aviso. */
  onDelete?: (task: Task) => void;
};

/** Quantos rostos a fila mostra antes de resumir o resto em "+N", o mesmo da ficha e do aviso do menu. */
const SHOWN_FACES = 3;

/** Quantas etiquetas cabem numa coluna de 19rem antes de virarem contagem. */
const SHOWN_TAGS = 2;

/* Controles com ação própria dentro do cartão: clique que nasce neles não abre a ficha. */
const INTERACTIVE = "button, a, input, label, [role='button'], [role='menuitem']";

/* Segura o evento no invólucro de um controle do cartão: nem arraste, nem abrir a ficha. */
const stop = (event: SyntheticEvent) => event.stopPropagation();

const priorities: TaskPriority[] = ["low", "normal", "high", "urgent"];

/* Os nomes ligados por "e" para a leitura por voz, como no cartão de tarefa do painel. */
const nameList = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" });

// O cartão do quadro (2026-09-10, sobre duas referências do usuário, pegando de cada uma o que ela faz
// melhor). Da primeira vem o corpo: a prioridade em etiqueta colorida abrindo o cartão, o título forte, a
// descrição em duas linhas, as etiquetas, e um pé com os rostos de quem está envolvido de um lado e as
// medidas do outro. Da segunda vem a **linha de contexto** logo abaixo do título, que situa a tarefa antes
// de ela ser lida por dentro: a pasta do projeto e o identificador que a pessoa fala.
//
// O que o modelo tem e a referência não mostrava entrou onde rende mais: o **aviso**, em glifo ao lado da
// prioridade, porque é a única coisa do cartão que pede leitura antes de mexer; e a **linha de trabalho**,
// com o progresso das subtarefas e a estimativa, que é a resposta de "quanto falta" sem abrir a ficha.
//
// A ordem é a de quem varre a coluna com o olho: o que é urgente, o que é, onde mora, o que diz, como está
// classificado, quanto falta, e por fim quem cuida e quando vence. Etiquetas, trabalho e as contagens do pé
// só aparecem quando existem, então tarefa simples tem cartão curto e tarefa cheia tem cartão cheio.
export const TaskCard = memo(function TaskCard({
  task,
  onOpen,
  drag,
  overlay = false,
  stages,
  onMove,
  onDelete,
  celebrating = false,
  onCelebrated,
}: TaskCardProps) {
  const due = dueOf(task);
  const faces = task.people.slice(0, SHOWN_FACES);
  const restFaces = task.people.length - faces.length;
  const tags = task.tags.slice(0, SHOWN_TAGS);
  const restTags = task.tags.length - tags.length;
  const done = subtasksDone(task);
  const hasWork = task.subtasks.length > 0 || task.estimate !== undefined;
  /* A troca direto no cartão (2026-09-23, a pedido): prioridade, envolvidos e etiquetas abrem o mesmo menu da
     ficha no lugar onde estão. Só no quadro, que é quem grava, e nunca no cartão que flutua no arraste. */
  const editor = useCardEdit();
  const edit = overlay ? null : editor;

  const prioritySections: DropdownSection[] = edit
    ? [
        {
          id: "priority",
          label: "Prioridade",
          items: priorities.map((priority) => ({
            id: `priority-${priority}`,
            label: priorityLabels[priority],
            media: priorityMark(priority),
            selected: task.priority === priority,
            onSelect: () => priority !== task.priority && edit.edit(task, { priority }),
          })),
        },
      ]
    : [];

  /* O responsável fica sempre de fora da escolha: ele é o primeiro rosto, e troca na ficha. */
  const candidates = edit
    ? [...task.people, ...edit.team].filter(
        (person, index, list) => person.name !== task.owner.name && list.findIndex((entry) => entry.name === person.name) === index,
      )
    : [];

  const peopleSections: DropdownSection[] = [
    {
      id: "people",
      label: "Quem está envolvido",
      items: candidates.map((person) => ({
        kind: "toggle" as const,
        id: `person-${person.name}`,
        label: person.name,
        media: <Avatar name={person.name} src={person.avatarUrl ?? undefined} size="xs" />,
        checked: task.people.some((entry) => entry.name === person.name),
        onChange: (on: boolean) =>
          edit?.edit(task, { people: on ? [...task.people, person] : task.people.filter((entry) => entry.name !== person.name) }),
      })),
    },
  ];

  const tagOptions = edit ? tagSections(taskTagCatalog, task.tags, (next) => edit.edit(task, { tags: next }), TASK_MAX_TAGS) : [];

  const dueBadge = (
    <Badge tone={due.tone} size="sm" icon={<CalendarBlankIcon />}>
      {due.label}
    </Badge>
  );

  const priorityBadge = (
    <Badge tone={priorityTones[task.priority]} size="sm" icon={<FlagIcon />}>
      {priorityLabels[task.priority]}
    </Badge>
  );

  const tagRow =
    tags.length > 0 ? (
      <span className={styles.tags}>
        {tags.map((tag) => (
          <Badge key={tag} size="sm" hue={tagHue(tag)} className={styles.tag}>
            {tag}
          </Badge>
        ))}
        {restTags > 0 && (
          <Badge size="sm" variant="outline" title={task.tags.slice(SHOWN_TAGS).join(", ")}>
            +{restTags}
          </Badge>
        )}
      </span>
    ) : (
      <span className={styles.empty}>
        <TagIcon aria-hidden="true" />
        Etiquetas
      </span>
    );

  const faceRow = (
    <span className={styles.people}>
      <AvatarGroup className={styles.faces}>
        {faces.map((person) => (
          <Avatar key={person.name} name={person.name} src={person.avatarUrl ?? undefined} size="xs" />
        ))}
      </AvatarGroup>
      {restFaces > 0 && (
        <Text as="span" variant="caption1" tone="secondary" className={styles.more}>
          +{restFaces}
        </Text>
      )}
      <VisuallyHidden>
        Responsável: {task.owner.name}. Envolvidos: {nameList.format(task.people.map((person) => person.name))}
      </VisuallyHidden>
    </span>
  );

  const onClick = (event: MouseEvent<HTMLElement>) => {
    const control = (event.target as HTMLElement).closest(INTERACTIVE);
    if (control && control !== event.currentTarget) return;
    onOpen(task);
  };

  /**
   * As duas teclas do cartão, e só quando o foco está nele mesmo (dentro dele o Enter é do leque):
   * **Enter abre** a ficha e **Espaço pega** o cartão para mover de etapa, que é do arraste. Elas caíam na
   * mesma mão, e esta ganhava por vir depois do espalhamento dos ouvintes do gesto, então o teclado nunca
   * movia nada (2026-09-10).
   */
  const dragKeyDown = drag?.listeners?.onKeyDown as ((event: KeyboardEvent<HTMLElement>) => void) | undefined;

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter") {
      event.preventDefault();
      onOpen(task);
      return;
    }
    if (event.key === " ") dragKeyDown?.(event);
  };

  return (
    <li
      ref={drag?.ref}
      className={styles.card}
      data-dragging={drag?.dragging || undefined}
      data-overlay={overlay || undefined}
      {...rounded("xl", { clip: true })}
    >
      <div
        {...drag?.attributes}
        {...drag?.listeners}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`Ver ${task.title}`}
        className={styles.inner}
        data-grab={drag ? "" : undefined}
        onClick={onClick}
        onKeyDown={onKeyDown}
        {...roundedAuto({ clip: true })}
      >
        {/* O topo: a prioridade, o aviso quando há, e o leque na outra ponta. O aviso é só glifo, porque o
            texto dele mora na ficha; aqui ele avisa que existe. */}
        <div className={styles.head}>
          {edit ? (
            <DropdownMenu
              label="Prioridade"
              triggerLabel={`Prioridade: ${priorityLabels[task.priority]}. Trocar`}
              sections={prioritySections}
              triggerContent={priorityBadge}
            />
          ) : (
            priorityBadge
          )}
          {task.alert && <Badge tone="warning" size="sm" icon={<WarningIcon weight="fill" />} label="Tem um aviso para ler antes de mexer" />}
          {!overlay && (
            <span className={styles.menu}>
              <TaskMenu
                task={task}
                onOpen={() => onOpen(task)}
                stages={stages}
                onMove={onMove && ((stage) => onMove(task, stage))}
                onDelete={onDelete && (() => onDelete(task))}
              />
            </span>
          )}
        </div>

        {/* Onde a tarefa mora, antes do título (2026-09-22, a pedido: rota, título e descrição, nessa ordem):
            a pasta do projeto e o identificador, na mesma linha e apagados. Sem projeto, sobra o identificador. */}
        <p className={styles.context}>
          {task.project && (
            <>
              <FolderIcon aria-hidden="true" className={styles.contextIcon} />
              <span className={styles.project}>{task.project.name}</span>
              <span className={styles.dot} aria-hidden="true">
                /
              </span>
            </>
          )}
          <span className={styles.reference}>{task.reference}</span>
        </p>

        <Text as="h3" variant="callout" weight="semibold" className={styles.title}>
          {task.title}
        </Text>

        <Text variant="footnote" tone="secondary" className={styles.description}>
          {task.description}
        </Text>

        {/* Sem etiqueta, o quadro que edita mostra o convite apagado; o que só lê não mostra nada. */}
        {edit ? (
          <div className={styles.tagLine}>
            <DropdownMenu label="Etiquetas da tarefa" triggerLabel="Escolher etiquetas" sections={tagOptions} triggerContent={tagRow} />
          </div>
        ) : (
          tags.length > 0 && <div className={styles.tagLine}>{tagRow}</div>
        )}

        {/* Quanto falta: a barra com um segmento por subtarefa, a conta ao lado, e a estimativa na outra
            ponta. A barra é a mesma peça que a ficha usa nas subtarefas, no mesmo tom. */}
        {hasWork && (
          <div className={styles.work}>
            {task.subtasks.length > 0 && (
              <>
                <Progress
                  value={done}
                  max={task.subtasks.length}
                  segments={task.subtasks.length}
                  size="xs"
                  tone="success"
                  className={styles.progress}
                  aria-label={`Subtarefas concluídas: ${done} de ${task.subtasks.length}`}
                />
                <Text as="span" variant="caption1" tone="secondary" className={styles.workCount}>
                  {done}/{task.subtasks.length}
                </Text>
              </>
            )}
            {task.estimate !== undefined && (
              <span className={styles.estimate}>
                <TimerIcon aria-hidden="true" />
                <Text as="span" variant="caption1" tone="inherit">
                  {estimateLabel(task.estimate)}
                </Text>
                <VisuallyHidden>de estimativa</VisuallyHidden>
              </span>
            )}
          </div>
        )}

        {/* O pé: quem cuida de um lado, quando vence e o que há para ler do outro. O primeiro rosto é sempre
            quem responde pela tarefa, e os nomes inteiros seguem na leitura por voz, porque na tela são só
            bolinhas. */}
        <div className={styles.foot}>
          {edit && candidates.length > 0 ? (
            <DropdownMenu label="Envolvidos" triggerLabel="Escolher quem está envolvido" sections={peopleSections} triggerContent={faceRow} />
          ) : (
            faceRow
          )}

          {/* As contagens do que a tarefa carrega, no canto e apagadas: vínculos, anexos e conversa. Só
              aparece a que existe, então o pé de uma tarefa simples fica só com o prazo. */}
          <span className={styles.meta}>
            {task.links.length > 0 && (
              <span className={styles.count}>
                <LinkSimpleIcon aria-hidden="true" />
                <Text as="span" variant="caption1" tone="inherit">
                  {task.links.length}
                </Text>
                <VisuallyHidden>{task.links.length === 1 ? "registro vinculado" : "registros vinculados"}</VisuallyHidden>
              </span>
            )}
            {task.attachments.length > 0 && (
              <span className={styles.count}>
                <PaperclipIcon aria-hidden="true" />
                <Text as="span" variant="caption1" tone="inherit">
                  {task.attachments.length}
                </Text>
                <VisuallyHidden>anexos</VisuallyHidden>
              </span>
            )}
            {task.activity.length > 0 && (
              <span className={styles.count}>
                <ClockCounterClockwiseIcon aria-hidden="true" />
                <Text as="span" variant="caption1" tone="inherit">
                  {task.activity.length}
                </Text>
                <VisuallyHidden>registros de atividade</VisuallyHidden>
              </span>
            )}
            {edit ? (
              /* O prazo abre o calendário no próprio cartão. O invólucro segura o toque, senão ele começava o
                 arraste do cartão e o clique no calendário, que sobe pela árvore do React, abria a ficha. */
              <span role="presentation" className={styles.due} onClick={stop} onPointerDown={stop} onKeyDown={stop}>
                <DatePicker
                  plain
                  value={parseISO(task.dueDate)}
                  onChange={(date) => date && format(date, "yyyy-MM-dd") !== task.dueDate && edit.edit(task, { dueDate: format(date, "yyyy-MM-dd") })}
                  triggerLabel={`Prazo: ${due.label}. Trocar`}
                  triggerContent={dueBadge}
                />
              </span>
            ) : (
              dueBadge
            )}
          </span>
        </div>
      </div>
      {/* Concluída pelo arraste, só como efeito (2026-09-23, a pedido): o véu com o check cobre o cartão e some. */}
      {celebrating && <SuccessOverlay onDone={onCelebrated} />}
    </li>
  );
});
