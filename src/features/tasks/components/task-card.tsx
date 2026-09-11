"use client";

import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { CalendarBlankIcon, ClockCounterClockwiseIcon, FlagIcon, FolderIcon, PaperclipIcon, TimerIcon, WarningIcon } from "@phosphor-icons/react";
import type { KeyboardEvent, MouseEvent } from "react";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { squircle, squircleAuto } from "@/lib/corners";
import { dueOf, estimateLabel, priorityLabels, priorityTones, subtasksDone } from "../labels";
import type { TaskStage } from "../stages";
import type { Task } from "../summary";
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
  task: Task;
  onOpen: () => void;
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
  onMove?: (stage: TaskStage) => void;
};

/** Quantos rostos a fila mostra antes de resumir o resto em "+N", o mesmo da ficha e do aviso do menu. */
const SHOWN_FACES = 3;

/** Quantas etiquetas cabem numa coluna de 19rem antes de virarem contagem. */
const SHOWN_TAGS = 2;

/* Controles com ação própria dentro do cartão: clique que nasce neles não abre a ficha. */
const INTERACTIVE = "button, a, input, label, [role='button'], [role='menuitem']";

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
export function TaskCard({ task, onOpen, drag, overlay = false, stages, onMove }: TaskCardProps) {
  const due = dueOf(task);
  const faces = task.people.slice(0, SHOWN_FACES);
  const restFaces = task.people.length - faces.length;
  const tags = task.tags.slice(0, SHOWN_TAGS);
  const restTags = task.tags.length - tags.length;
  const done = subtasksDone(task);
  const hasWork = task.subtasks.length > 0 || task.estimate !== undefined;

  const onClick = (event: MouseEvent<HTMLElement>) => {
    const control = (event.target as HTMLElement).closest(INTERACTIVE);
    if (control && control !== event.currentTarget) return;
    onOpen();
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
      onOpen();
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
      {...squircle("xl", { clip: true })}
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
        {...squircleAuto({ clip: true })}
      >
        {/* O topo: a prioridade, o aviso quando há, e o leque na outra ponta. O aviso é só glifo, porque o
            texto dele mora na ficha; aqui ele avisa que existe. */}
        <div className={styles.head}>
          <Badge tone={priorityTones[task.priority]} size="sm" icon={<FlagIcon />}>
            {priorityLabels[task.priority]}
          </Badge>
          {task.alert && <Badge tone="warning" size="sm" icon={<WarningIcon weight="fill" />} label="Tem um aviso para ler antes de mexer" />}
          {!overlay && (
            <span className={styles.menu}>
              <TaskMenu task={task} onOpen={onOpen} stages={stages} onMove={onMove} />
            </span>
          )}
        </div>

        <Text as="h3" variant="subheadline" weight="semibold" className={styles.title}>
          {task.title}
        </Text>

        {/* Onde a tarefa mora: a pasta do projeto e o identificador, na mesma linha e apagados. Sem projeto,
            sobra o identificador sozinho. */}
        <p className={styles.context}>
          {task.project && (
            <>
              <FolderIcon aria-hidden="true" className={styles.contextIcon} />
              <span className={styles.project}>{task.project.name}</span>
              <span className={styles.dot} aria-hidden="true">
                ·
              </span>
            </>
          )}
          <span className={styles.reference}>{task.reference}</span>
        </p>

        <Text variant="footnote" tone="secondary" className={styles.description}>
          {task.description}
        </Text>

        {tags.length > 0 && (
          <div className={styles.tags}>
            {tags.map((tag) => (
              <Badge key={tag} size="sm" className={styles.tag}>
                {tag}
              </Badge>
            ))}
            {restTags > 0 && (
              <Badge size="sm" variant="outline" title={task.tags.slice(SHOWN_TAGS).join(", ")}>
                +{restTags}
              </Badge>
            )}
          </div>
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

          <span className={styles.meta}>
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
            <Badge tone={due.tone} size="sm" icon={<CalendarBlankIcon />}>
              {due.label}
            </Badge>
          </span>
        </div>
      </div>
    </li>
  );
}
