"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Announcements,
  type ClientRect,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { ArrowCounterClockwiseIcon, PlusIcon, WarningCircleIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { Button } from "@/components/ui/button";
import type { DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { saveStageOverrides, type StageOverrides } from "../board-cookie";
import {
  DEADLINE_PARAM,
  DEFAULT_COLUMN_SORT,
  OVERDUE_PARAM,
  PRIORITY_PARAM,
  QUERY_PARAM,
  activeTasksFilters,
  clearedFilters,
  columnSortIcons,
  deadlineOptions,
  defaultQuery,
  priorityFilterLabels,
  priorityFilterValues,
  sortColumn,
  type TasksBoardData,
  type TasksColumnSort,
  type TasksQuery,
} from "../list-options";
import { stageValues, taskStageMeta, type TaskStage } from "../stages";
import type { AppRecord } from "@/features/records/records";
import type { Task, TaskPerson } from "../summary";
import { TaskCard } from "./task-card";
import { TaskColumn } from "./task-column";
import { TaskDialog } from "./task-dialog";
import styles from "./tasks-board.module.css";

export type TasksBoardProps = {
  board: TasksBoardData;
  query: TasksQuery;
  /** O que o cookie guardou de decidido em cada etapa, para o quadro nascer do jeito que a pessoa deixou. */
  collapsed: StageOverrides;
  /** Onde o filtro é escrito: `/tarefas`, ou `/tarefas/<slug>` na página de um projeto. */
  basePath: string;
  /** Quem pode assumir uma tarefa, para os seletores da janela; sem a equipe, valem as pessoas da tarefa. */
  team?: TaskPerson[];
  /** O índice do que existe na aplicação, para vincular e para marcar no comentário. */
  records?: AppRecord[];
};

/** Quanto o campo espera parar de digitar antes de refazer a busca no servidor. */
const TYPING_PAUSE = 320;

/**
 * Quanto o ponteiro precisa andar para o gesto virar arraste (2026-09-10): o cartão inteiro é a alça **e** o
 * botão que abre a ficha, então sem essa folga um clique com a mão trêmula abriria um arraste de um pixel e
 * comeria o clique.
 */
const DRAG_START = 6;

/**
 * Pelo teclado, as setas andam **de etapa em etapa**, e não de 25 em 25 pixels, que é o padrão do sensor: com
 * colunas de 19rem, uma seta não saía do lugar e mover uma tarefa pediria doze toques. A conta é feita sobre
 * os retângulos que o próprio arraste já mediu, ordenados como estão na tela, então ela vale igual com etapa
 * recolhida no meio do caminho.
 */
const byStage: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  const step = event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;
  if (step === 0) return undefined;
  event.preventDefault();

  const rails = context.droppableContainers
    .getEnabled()
    .map((container) => ({ id: container.id, rect: context.droppableRects.get(container.id) }))
    .filter((entry): entry is { id: string | number; rect: ClientRect } => Boolean(entry.rect))
    .sort((a, b) => a.rect.left - b.rect.left);
  if (rails.length === 0) return undefined;

  /* De onde se parte: a etapa sob o cartão, ou a que contém o ponto em que ele está. */
  const from = rails.findIndex((rail) =>
    context.over ? rail.id === context.over.id : currentCoordinates.x >= rail.rect.left && currentCoordinates.x <= rail.rect.right,
  );
  const next = rails[Math.min(rails.length - 1, Math.max(0, (from < 0 ? 0 : from) + step))];
  return { x: next.rect.left + next.rect.width / 2, y: currentCoordinates.y };
};

/* Enter abre a ficha da tarefa, então quem pega o cartão é o Espaço. */
const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    "Para mover a tarefa de etapa, aperte Espaço. Use as setas para escolher a etapa e aperte Espaço de novo para soltar. Esc cancela. Enter abre a tarefa.",
};

/* Toda coluna abre na ordem padrão da casa, o prazo. A escolha é de coluna, então são cinco. */
const initialSorts = Object.fromEntries(stageValues.map((stage) => [stage, DEFAULT_COLUMN_SORT])) as Record<TaskStage, TasksColumnSort>;

// O quadro de tarefas: a barra de busca e filtros em cima, como em toda tela da aplicação, e embaixo o
// trilho com as cinco etapas. O filtro vive na URL e quem faz o trabalho é o servidor, então a página é
// compartilhável e volta igual pelo histórico do navegador; aqui ficam só a espera do campo de busca, o
// filtro adiantado, a ordem de cada coluna e quais etapas estão recolhidas.
//
// A ficha da tarefa é **uma só para o quadro inteiro**, guardando quem está aberto, e não uma por cartão:
// com vinte e quatro cartões seriam vinte e quatro janelas montadas, que é a mesma decisão da gaveta da base
// de clientes.
export function TasksBoard({ board, query, collapsed: saved, basePath, team, records }: TasksBoardProps) {
  const router = useRouter();
  const [search, setSearch] = useState(query.search);
  // O filtro em vigor na tela, adiantado: a escolha marca na hora e a URL vai atrás, senão o check só
  // aparecia quando o servidor devolvia o quadro. Quando a resposta chega, o que veio da URL passa a valer,
  // ajustado durante o render, que é como o React pede para reagir a prop nova.
  const [live, setLive] = useState(query);
  const [seen, setSeen] = useState(query);
  if (seen !== query) {
    setSeen(query);
    setLive(query);
  }
  const [overrides, setOverrides] = useState<StageOverrides>(saved);
  const [sorts, setSorts] = useState<Record<TaskStage, TasksColumnSort>>(initialSorts);
  const [open, setOpen] = useState<Task | null>(null);
  /**
   * Para onde cada tarefa foi arrastada, por id (2026-09-10, a pedido). É um mapa de destinos, e não uma
   * cópia da lista: o quadro em si continua vindo do servidor a cada filtro, e uma cópia sairia de sincronia
   * na primeira busca. **Vale só na tela**, como o resto do que a ficha muda; quem ligar a tabela troca este
   * `setMoved` por uma Server Action com o mesmo par (tarefa, etapa).
   */
  const [moved, setMoved] = useState<Record<string, TaskStage>>({});
  /** A tarefa na mão, para o cartão que flutua sob o ponteiro e para saber de onde ela saiu. */
  const [dragging, setDragging] = useState<{ task: Task; from: TaskStage } | null>(null);
  /** Em que coluna ela cairia agora, para a etapa acender e abrir o lugar dele. */
  const [landing, setLanding] = useState<TaskStage | null>(null);
  const typing = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(typing.current), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_START } }),
    useSensor(KeyboardSensor, { coordinateGetter: byStage }),
  );

  const go = useCallback(
    (next: Partial<TasksQuery>) => {
      const merged = { ...live, ...next };
      setLive(merged);
      const params = new URLSearchParams();
      if (merged.search) params.set(QUERY_PARAM, merged.search);
      if (merged.priority !== defaultQuery.priority) params.set(PRIORITY_PARAM, merged.priority);
      if (merged.deadline !== defaultQuery.deadline) params.set(DEADLINE_PARAM, merged.deadline);
      if (merged.overdue) params.set(OVERDUE_PARAM, "1");

      const search = params.toString();
      startTransition(() => router.replace((search ? `${basePath}?${search}` : basePath) as Route, { scroll: false }));
    },
    [live, router, basePath],
  );

  // Cada tecla refaz o quadro no servidor, então o campo espera a pessoa parar de digitar: sem isso seria
  // uma ida ao servidor por letra.
  const onSearch = (value: string) => {
    setSearch(value);
    window.clearTimeout(typing.current);
    typing.current = window.setTimeout(() => go({ search: value }), TYPING_PAUSE);
  };

  /**
   * **Etapa vazia nasce fechada** (2026-09-10, a pedido): numa lista de oito etapas, as que não têm nada só
   * empurravam as que têm para fora da vista, e o quadro abria pedindo rolagem para nada. O que a pessoa
   * decide no clique vale mais que o padrão e vai para o cookie, então abrir uma vazia sobrevive à recarga e
   * fechar uma cheia também.
   */
  const isCollapsed = (stage: TaskStage, count: number) => overrides[stage] ?? count === 0;

  const changeCollapsed = (stage: TaskStage, on: boolean) => {
    const next = { ...overrides, [stage]: on };
    setOverrides(next);
    saveStageOverrides(next);
  };

  const changeSort = (stage: TaskStage, sort: TasksColumnSort) => setSorts((current) => ({ ...current, [stage]: sort }));

  /**
   * As colunas como elas estão na tela: as do servidor com os destinos do arraste aplicados. A tarefa entra
   * na coluna de destino e sai da de origem, e a ordem de dentro segue sendo a que a coluna escolheu, porque
   * é ela quem manda na pilha; arrastar muda a etapa, e não o lugar na fila.
   */
  const columns = useMemo(() => {
    if (Object.keys(moved).length === 0) return board.columns;
    const known = new Set(board.columns.map((column) => column.stage));
    const piles = new Map<TaskStage, Task[]>(board.columns.map((column) => [column.stage, []]));
    for (const column of board.columns) {
      for (const task of column.tasks) {
        const to = moved[task.id];
        /* Destino que este quadro não tem (o filtro mudou, o projeto é outro) fica de fora: a tarefa
           continua onde o servidor a pôs. */
        const target = to && known.has(to) ? to : column.stage;
        piles.get(target)?.push(target === task.stage ? task : { ...task, stage: target });
      }
    }
    return board.columns.map((column) => ({ ...column, tasks: piles.get(column.stage) ?? [] }));
  }, [board.columns, moved]);

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as { task?: Task; stage?: TaskStage } | undefined;
    if (data?.task && data.stage) setDragging({ task: data.task, from: data.stage });
  };

  /* Enquanto o cartão está no ar, a etapa sob ele acende; a de origem não, porque soltar ali não é mover. */
  const onDragOver = (event: { over: { id: string | number } | null }) => {
    const over = event.over?.id as TaskStage | undefined;
    setLanding(over && over !== dragging?.from ? over : null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const to = event.over?.id as TaskStage | undefined;
    const task = dragging?.task;
    setDragging(null);
    setLanding(null);
    if (!task || !to || to === dragging?.from) return;
    setMoved((current) => ({ ...current, [task.id]: to }));
    /* Soltar numa etapa recolhida abre ela: a tarefa acabou de chegar, e um trilho fechado a esconderia. */
    if (overrides[to] === true || (overrides[to] === undefined && countOf(to) === 0)) changeCollapsed(to, false);
  };

  const countOf = (stage: TaskStage) => columns.find((column) => column.stage === stage)?.tasks.length ?? 0;

  /* O que o leitor de tela ouve em cada passo do gesto, nas palavras da casa. */
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Pegou ${nameOf(active.id)}. Use as setas para escolher a etapa.`,
    onDragOver: ({ over }) => (over ? `Sobre a etapa ${taskStageMeta[over.id as TaskStage].label}.` : "Fora das etapas."),
    onDragEnd: ({ active, over }) =>
      over ? `${nameOf(active.id)} foi para ${taskStageMeta[over.id as TaskStage].label}.` : `${nameOf(active.id)} ficou onde estava.`,
    onDragCancel: ({ active }) => `Arraste de ${nameOf(active.id)} cancelado.`,
  };

  const nameOf = (id: string | number) =>
    columns.flatMap((column) => column.tasks).find((task) => task.id === id)?.title ?? "a tarefa";

  const active = activeTasksFilters(live);

  /* O menu de filtros, tudo num lugar só: prioridade e prazo em escolha única, marcadas pelo check, e "só
     atrasadas" em interruptor, porque é sim ou não. Cada escolha vale na hora e não fecha o menu, porque a
     pessoa costuma ajustar mais de uma coisa antes de sair; limpar volta tudo ao padrão e só aparece com
     algo em vigor. */
  const filterSections: DropdownSection[] = [
    {
      id: "priority",
      label: "Prioridade",
      items: priorityFilterValues.map((value) => ({
        id: `priority-${value}`,
        label: priorityFilterLabels[value],
        selected: live.priority === value,
        keepOpen: true,
        onSelect: () => go({ priority: value }),
      })),
    },
    {
      id: "deadline",
      label: "Prazo",
      items: deadlineOptions.map((option) => ({
        id: `deadline-${option.value}`,
        label: option.label,
        icon: columnSortIcons.deadline,
        selected: live.deadline === option.value,
        keepOpen: true,
        onSelect: () => go({ deadline: option.value }),
      })),
    },
    {
      id: "state",
      label: "Situação",
      items: [
        {
          kind: "toggle",
          id: "overdue",
          label: "Só atrasadas",
          icon: WarningCircleIcon,
          checked: live.overdue,
          onChange: (overdue) => go({ overdue }),
        },
      ],
    },
    ...(active.length > 0
      ? [{ id: "reset", items: [{ id: "reset", label: "Limpar filtros", icon: ArrowCounterClockwiseIcon, onSelect: () => go(clearedFilters) }] }]
      : []),
  ];

  return (
    <div className={styles.board}>
      <PageToolbar
        search={{ value: search, onChange: onSearch, placeholder: "Buscar tarefas", label: "Buscar tarefa" }}
        filters={filterSections}
        activeFilters={active.map((filter) => ({ id: filter.id, label: filter.label, icon: filter.icon, onClear: () => go(filter.clear) }))}
        action={
          <>
            <span className={styles.wide}>
              <Button size="sm" radius="md" iconStart={<PlusIcon />}>
                Nova tarefa
              </Button>
            </span>
            <span className={styles.narrow}>
              <IconButton label="Nova tarefa" size="sm" radius="md">
                <PlusIcon />
              </IconButton>
            </span>
          </>
        }
      />

      {/* Sem nada que bata com o filtro, a frase toma o lugar do trilho: cinco colunas vazias lado a lado
          leriam como quadro quebrado, e não como busca sem resultado. */}
      {board.matched === 0 ? (
        <div className={styles.empty}>
          <Text variant="callout" weight="semibold">
            Nenhuma tarefa por aqui
          </Text>
          <Text variant="footnote" tone="secondary">
            {board.total === 0
              ? "Crie a primeira tarefa para o quadro começar a andar."
              : live.search
                ? "Nada bateu com o que você procurou. Tente outro título, etiqueta ou nome de quem está envolvido."
                : "Ajuste o prazo ou os filtros para ver mais."}
          </Text>
        </div>
      ) : (
        // O arraste do quadro: pegar o cartão, passear pelas etapas e soltar. `closestCorners` acha a coluna
        // pela quina mais perto, que é o que funciona com alvos altos e estreitos lado a lado, e o cartão que
        // flutua fica preso à janela pelo modificador.
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          accessibility={{ announcements, screenReaderInstructions }}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setDragging(null);
            setLanding(null);
          }}
        >
          <div className={styles.rail} data-dragging={dragging ? "" : undefined}>
            {columns.map((column) => (
              <TaskColumn
                key={column.stage}
                stage={taskStageMeta[column.stage]}
                tasks={sortColumn(column.tasks, sorts[column.stage])}
                collapsed={isCollapsed(column.stage, column.tasks.length)}
                onCollapsedChange={(on) => changeCollapsed(column.stage, on)}
                sort={sorts[column.stage]}
                onSortChange={(sort) => changeSort(column.stage, sort)}
                onOpen={setOpen}
                onAdd={() => undefined}
                landing={landing === column.stage}
              />
            ))}
          </div>

          {/* O cartão na mão, sob o ponteiro: o mesmo desenho, inclinado e erguido, para ficar claro que ele
              saiu da pilha e está sendo levado. */}
          <DragOverlay modifiers={[restrictToWindowEdges]} dropAnimation={null}>
            {dragging && (
              <ul className={styles.flying}>
                <TaskCard task={dragging.task} onOpen={() => undefined} overlay />
              </ul>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Fica montada e vazia depois de fechar, para a saída animar. As etapas que a janela oferece são as
          deste quadro, e não as do catálogo: mover a tarefa para uma etapa que o projeto não tem a deixaria
          sem coluna onde cair. */}
      <TaskDialog
        task={open}
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        stages={board.columns.map((column) => column.stage)}
        team={team}
        records={records}
      />
    </div>
  );
}
