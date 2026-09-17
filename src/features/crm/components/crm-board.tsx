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
import { ArrowCounterClockwiseIcon, FunnelIcon, HourglassIcon, PlusIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFloatingPagerRegistration } from "@/components/layout/floating-actions";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { saveCrmStageOverrides, type CrmStageOverrides } from "../board-cookie";
import {
  DEFAULT_CRM_SORT,
  HORIZON_PARAM,
  QUERY_PARAM,
  STALE_PARAM,
  TEMPERATURE_PARAM,
  activeCrmFilters,
  clearedCrmFilters,
  crmSortIcons,
  defaultCrmQuery,
  horizonOptions,
  sortCrmColumn,
  temperatureFilterLabels,
  temperatureFilterValues,
  type CrmBoardData,
  type CrmColumnSort,
  type CrmQuery,
} from "../list-options";
import { crmStageMeta, crmStageValues, type CrmStage } from "../stages";
import type { CrmPerson, Opportunity } from "../summary";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/providers/toast-provider";
import { deleteOpportunityAction } from "../actions";
import { OpportunityCard } from "./opportunity-card";
import { OpportunityColumn } from "./opportunity-column";
import { OpportunityDialog } from "./opportunity-dialog";
import styles from "./crm-board.module.css";

export type CrmBoardProps = {
  board: CrmBoardData;
  query: CrmQuery;
  /** O que o cookie guardou de decidido em cada etapa, para o quadro nascer do jeito que a pessoa deixou. */
  collapsed: CrmStageOverrides;
  /** Onde o filtro é escrito: `/crm`, ou `/crm/<slug>` na página de um funil. */
  basePath: string;
  /** Quem pode assumir uma venda, para os seletores da ficha. */
  team?: CrmPerson[];
};

/** Quanto o campo espera parar de digitar antes de refazer a busca no servidor. */
const TYPING_PAUSE = 320;

/** Quanto o ponteiro precisa andar para o gesto virar arraste: o cartão inteiro é a alça **e** o botão que
 *  abre a ficha, então sem essa folga um clique com a mão trêmula abriria um arraste de um pixel. */
const DRAG_START = 6;

/** Pelo teclado, as setas andam de etapa em etapa, e não de 25 em 25 pixels, que é o padrão do sensor. */
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

  const from = rails.findIndex((rail) =>
    context.over ? rail.id === context.over.id : currentCoordinates.x >= rail.rect.left && currentCoordinates.x <= rail.rect.right,
  );
  const next = rails[Math.min(rails.length - 1, Math.max(0, (from < 0 ? 0 : from) + step))];
  return { x: next.rect.left + next.rect.width / 2, y: currentCoordinates.y };
};

/* Enter abre a ficha da oportunidade, então quem pega o cartão é o Espaço. */
const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    "Para mover a oportunidade de etapa, aperte Espaço. Use as setas para escolher a etapa e aperte Espaço de novo para soltar. Esc cancela. Enter abre a oportunidade.",
};

/* No celular o quadro não arrasta, e a concha do `DndContext` fica montada sem sensor nenhum. */
const noSensors: ReturnType<typeof useSensors> = [];

/* Toda coluna abre na ordem padrão do funil, a previsão de fechamento. A escolha é de coluna. */
const initialSorts = Object.fromEntries(crmStageValues.map((stage) => [stage, DEFAULT_CRM_SORT])) as Record<CrmStage, CrmColumnSort>;

// O quadro do funil de vendas, na mesma arquitetura do quadro de tarefas: a barra de busca e filtros em
// cima, e embaixo o trilho com as etapas. O filtro vive na URL e quem faz o trabalho é o servidor, então a
// página é compartilhável e volta igual pelo histórico do navegador; aqui ficam só a espera do campo de
// busca, o filtro adiantado, a ordem de cada coluna e quais etapas estão recolhidas.
//
// A ficha da oportunidade é **uma só para o quadro inteiro**, guardando quem está aberto, e não uma por
// cartão: com vinte e dois cartões seriam vinte e duas janelas montadas.
export function CrmBoard({ board, query, collapsed: saved, basePath, team }: CrmBoardProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [search, setSearch] = useState(query.search);
  // O filtro em vigor na tela, adiantado: a escolha marca na hora e a URL vai atrás. Quando a resposta
  // chega, o que veio da URL passa a valer, ajustado durante o render.
  const [live, setLive] = useState(query);
  const [seen, setSeen] = useState(query);
  if (seen !== query) {
    setSeen(query);
    setLive(query);
  }
  const [overrides, setOverrides] = useState<CrmStageOverrides>(saved);
  const [sorts, setSorts] = useState<Record<CrmStage, CrmColumnSort>>(initialSorts);
  const [open, setOpen] = useState<Opportunity | null>(null);

  /* A exclusão, no desenho das outras telas: o leque do cartão pede, a janela da casa pergunta, e só então a
     action grava. */
  const [deleting, setDeleting] = useState<Opportunity | null>(null);
  const [removing, setRemoving] = useState(false);

  const removeOpportunity = async () => {
    if (!deleting) return;
    setRemoving(true);
    const result = await deleteOpportunityAction(deleting.id);
    setRemoving(false);

    if (!result.ok) {
      toast({ title: "Não deu para excluir", description: result.error, tone: "danger" });
      return;
    }

    setDeleting(null);
    setOpen((current) => (current?.id === deleting.id ? null : current));
    toast({ title: "Oportunidade excluída", description: `${deleting.title} saiu do funil.`, tone: "success" });
    router.refresh();
  };

  /** No celular o cartão não se arrasta: a coluna ocupa quase a tela inteira e o trilho rola na horizontal,
   *  então o mesmo gesto serviria para as duas coisas. Quem move ali é a ficha e o "Mover para" do leque. */
  const mobile = useMediaQuery(MOBILE_QUERY);
  /** Para onde cada oportunidade foi arrastada, por id. É um mapa de destinos, e não uma cópia da lista: o
   *  quadro em si continua vindo do servidor a cada filtro. Vale só na tela enquanto não há tabela. */
  const [moved, setMoved] = useState<Record<string, CrmStage>>({});
  const [dragging, setDragging] = useState<{ opportunity: Opportunity; from: CrmStage } | null>(null);
  const [landing, setLanding] = useState<CrmStage | null>(null);
  const typing = useRef<number | undefined>(undefined);
  /** O trilho, para a barra flutuante levar o quadro até a etapa escolhida e para saber qual está à vista. */
  const rail = useRef<HTMLDivElement>(null);
  const [stagePage, setStagePage] = useState(1);

  useEffect(() => () => window.clearTimeout(typing.current), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_START } }),
    useSensor(KeyboardSensor, { coordinateGetter: byStage }),
  );

  const go = useCallback(
    (next: Partial<CrmQuery>) => {
      const merged = { ...live, ...next };
      setLive(merged);
      const params = new URLSearchParams();
      if (merged.search) params.set(QUERY_PARAM, merged.search);
      if (merged.temperature !== defaultCrmQuery.temperature) params.set(TEMPERATURE_PARAM, merged.temperature);
      if (merged.horizon !== defaultCrmQuery.horizon) params.set(HORIZON_PARAM, merged.horizon);
      if (merged.stale) params.set(STALE_PARAM, "1");

      const search = params.toString();
      startTransition(() => router.replace((search ? `${basePath}?${search}` : basePath) as Route, { scroll: false }));
    },
    [live, router, basePath],
  );

  const onSearch = (value: string) => {
    setSearch(value);
    window.clearTimeout(typing.current);
    typing.current = window.setTimeout(() => go({ search: value }), TYPING_PAUSE);
  };

  /** Etapa vazia nasce fechada: numa lista de sete etapas, as que não têm nada só empurrariam as que têm
   *  para fora da vista. O que a pessoa decide no clique vale mais que o padrão e vai para o cookie. */
  const isCollapsed = (stage: CrmStage, count: number) => overrides[stage] ?? count === 0;

  const changeCollapsed = (stage: CrmStage, on: boolean) => {
    const next = { ...overrides, [stage]: on };
    setOverrides(next);
    saveCrmStageOverrides(next);
  };

  const changeSort = (stage: CrmStage, sort: CrmColumnSort) => setSorts((current) => ({ ...current, [stage]: sort }));

  /** As colunas como elas estão na tela: as do servidor com os destinos do arraste aplicados. */
  const columns = useMemo(() => {
    if (Object.keys(moved).length === 0) return board.columns;
    const known = new Set(board.columns.map((column) => column.stage));
    const piles = new Map<CrmStage, Opportunity[]>(board.columns.map((column) => [column.stage, []]));
    for (const column of board.columns) {
      for (const opportunity of column.opportunities) {
        const to = moved[opportunity.id];
        /* Destino que este quadro não tem (o filtro mudou, o funil é outro) fica de fora. */
        const target = to && known.has(to) ? to : column.stage;
        piles.get(target)?.push(target === opportunity.stage ? opportunity : { ...opportunity, stage: target });
      }
    }
    return board.columns.map((column) => ({ ...column, opportunities: piles.get(column.stage) ?? [] }));
  }, [board.columns, moved]);

  /** Qual coluna está centrada, lida da rolagem do próprio trilho: a barra mostra "3/7" e as setas andam a
   *  partir dali. Só no celular: acima disso o trilho mostra várias colunas de uma vez. */
  useEffect(() => {
    const node = rail.current;
    if (!node || !mobile) return;

    const read = () => {
      const middle = node.scrollLeft + node.clientWidth / 2;
      const items = Array.from(node.children) as HTMLElement[];
      let nearest = 0;
      let best = Infinity;
      items.forEach((item, index) => {
        const distance = Math.abs(item.offsetLeft + item.offsetWidth / 2 - middle);
        if (distance < best) {
          best = distance;
          nearest = index;
        }
      });
      setStagePage((current) => (current === nearest + 1 ? current : nearest + 1));
    };

    read();
    node.addEventListener("scroll", read, { passive: true });
    return () => node.removeEventListener("scroll", read);
  }, [mobile, columns.length, board.matched]);

  const goToStage = (page: number) => {
    const node = rail.current;
    const column = node?.children[page - 1] as HTMLElement | undefined;
    if (!node || !column) return;
    node.scrollTo({ left: column.offsetLeft + column.offsetWidth / 2 - node.clientWidth / 2, behavior: "smooth" });
  };

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as { opportunity?: Opportunity; stage?: CrmStage } | undefined;
    if (data?.opportunity && data.stage) setDragging({ opportunity: data.opportunity, from: data.stage });
  };

  const onDragOver = (event: { over: { id: string | number } | null }) => {
    const over = event.over?.id as CrmStage | undefined;
    setLanding(over && over !== dragging?.from ? over : null);
  };

  const countOf = (stage: CrmStage) => columns.find((column) => column.stage === stage)?.opportunities.length ?? 0;

  /** Levar uma oportunidade para outra etapa, venha o pedido de onde vier: do arraste, do leque do cartão ou
   *  da ficha. Fica num lugar só porque a etapa de destino recolhida precisa abrir nos três casos. */
  const moveOpportunity = (opportunity: Opportunity, to: CrmStage, from: CrmStage) => {
    if (to === from) return;
    setMoved((current) => ({ ...current, [opportunity.id]: to }));
    if (overrides[to] === true || (overrides[to] === undefined && countOf(to) === 0)) changeCollapsed(to, false);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const to = event.over?.id as CrmStage | undefined;
    const opportunity = dragging?.opportunity;
    const from = dragging?.from;
    setDragging(null);
    setLanding(null);
    if (!opportunity || !to || !from) return;
    moveOpportunity(opportunity, to, from);
  };

  const nameOf = (id: string | number) =>
    columns.flatMap((column) => column.opportunities).find((opportunity) => opportunity.id === id)?.title ?? "a oportunidade";

  /* O que o leitor de tela ouve em cada passo do gesto, nas palavras da casa. */
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Pegou ${nameOf(active.id)}. Use as setas para escolher a etapa.`,
    onDragOver: ({ over }) => (over ? `Sobre a etapa ${crmStageMeta[over.id as CrmStage].label}.` : "Fora das etapas."),
    onDragEnd: ({ active, over }) =>
      over ? `${nameOf(active.id)} foi para ${crmStageMeta[over.id as CrmStage].label}.` : `${nameOf(active.id)} ficou onde estava.`,
    onDragCancel: ({ active }) => `Arraste de ${nameOf(active.id)} cancelado.`,
  };

  const active = activeCrmFilters(live);
  /* Sem busca e sem filtro, um funil vazio quer dizer funil sem oportunidade nenhuma. */
  const filtering = Boolean(live.search) || active.length > 0;
  const clearAll = () => {
    setSearch("");
    go({ ...clearedCrmFilters, search: "" });
  };

  /** O quadro pendura a navegação das etapas na barra flutuante do celular, pelo modo de paginação que a
   *  barra já tem: no celular só uma etapa cabe na tela de cada vez. */
  useFloatingPagerRegistration(
    mobile && board.matched > 0 && columns.length > 1
      ? { page: stagePage, pageCount: columns.length, onPageChange: goToStage, label: "Etapas do funil" }
      : null,
  );

  const filterSections: DropdownSection[] = [
    {
      id: "temperature",
      label: "Temperatura",
      items: temperatureFilterValues.map((value) => ({
        id: `temperature-${value}`,
        label: temperatureFilterLabels[value],
        selected: live.temperature === value,
        keepOpen: true,
        onSelect: () => go({ temperature: value }),
      })),
    },
    {
      id: "horizon",
      label: "Previsão de fechamento",
      items: horizonOptions.map((option) => ({
        id: `horizon-${option.value}`,
        label: option.label,
        icon: crmSortIcons.expected,
        selected: live.horizon === option.value,
        keepOpen: true,
        onSelect: () => go({ horizon: option.value }),
      })),
    },
    {
      id: "state",
      label: "Situação",
      items: [
        {
          kind: "toggle",
          id: "stale",
          label: "Só paradas",
          icon: HourglassIcon,
          checked: live.stale,
          onChange: (stale) => go({ stale }),
        },
      ],
    },
    ...(active.length > 0
      ? [{ id: "reset", items: [{ id: "reset", label: "Limpar filtros", icon: ArrowCounterClockwiseIcon, onSelect: () => go(clearedCrmFilters) }] }]
      : []),
  ];

  return (
    <div className={styles.board}>
      <PageToolbar
        search={{ value: search, onChange: onSearch, placeholder: "Buscar oportunidades", label: "Buscar oportunidade" }}
        filters={filterSections}
        activeFilters={active.map((filter) => ({ id: filter.id, label: filter.label, icon: filter.icon, onClear: () => go(filter.clear) }))}
        action={
          <>
            <span className={styles.wide}>
              <Button size="sm" radius="md" iconStart={<PlusIcon />}>
                Nova oportunidade
              </Button>
            </span>
            <span className={styles.narrow}>
              <IconButton label="Nova oportunidade" size="sm" radius="md">
                <PlusIcon />
              </IconButton>
            </span>
          </>
        }
      />

      {/* Sem nada que bata com o filtro, a frase toma o lugar do trilho: sete colunas vazias lado a lado
          leriam como quadro quebrado, e não como busca sem resultado. */}
      {board.matched === 0 ? (
        /* Sem o botão de criar: cadastrar oportunidade ainda não existe, e o da barra de cima também não
           leva a lugar nenhum. Ele entra aqui no dia em que a criação entrar. */
        <EmptyState
          icon={FunnelIcon}
          title={filtering ? "Nenhuma oportunidade encontrada" : "Nenhuma oportunidade ainda"}
          description={
            filtering
              ? "Nada bateu com o que você procurou. Tente outro nome, cliente ou etiqueta, ou limpe a busca."
              : "Cadastre a primeira oportunidade para o funil começar a andar."
          }
        >
          {filtering && (
            <Button variant="secondary" size="sm" radius="md" iconStart={<ArrowCounterClockwiseIcon />} onClick={clearAll}>
              Limpar busca
            </Button>
          )}
        </EmptyState>
      ) : (
        <DndContext
          sensors={mobile ? noSensors : sensors}
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
          <div ref={rail} className={styles.rail} data-dragging={dragging ? "" : undefined}>
            {columns.map((column) => (
              <OpportunityColumn
                key={column.stage}
                stage={crmStageMeta[column.stage]}
                opportunities={sortCrmColumn(column.opportunities, sorts[column.stage])}
                collapsed={isCollapsed(column.stage, column.opportunities.length)}
                onCollapsedChange={(on) => changeCollapsed(column.stage, on)}
                sort={sorts[column.stage]}
                onSortChange={(sort) => changeSort(column.stage, sort)}
                onOpen={setOpen}
                onAdd={() => undefined}
                landing={landing === column.stage}
                draggable={!mobile}
                stages={board.columns.map((entry) => entry.stage)}
                onMove={(opportunity, to) => moveOpportunity(opportunity, to, column.stage)}
                onDelete={setDeleting}
              />
            ))}
          </div>

          <DragOverlay modifiers={[restrictToWindowEdges]} dropAnimation={null}>
            {dragging && (
              <ul className={styles.flying}>
                <OpportunityCard opportunity={dragging.opportunity} onOpen={() => undefined} overlay />
              </ul>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Fica montada e vazia depois de fechar, para a saída animar. As etapas que a ficha oferece são as
          deste quadro, e não as do catálogo: mover para uma etapa que o funil não tem deixaria a venda sem
          coluna onde cair. */}
      <OpportunityDialog
        opportunity={open}
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        stages={board.columns.map((column) => column.stage)}
        team={team}
        onStageChange={(stage) => {
          if (!open) return;
          moveOpportunity(open, stage, open.stage);
          setOpen({ ...open, stage });
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        pending={removing}
        title={`Excluir ${deleting?.reference ?? "oportunidade"}?`}
        description="A oportunidade sai do funil com o histórico dela. O cliente e o orçamento que saíram daqui ficam."
        onClose={() => setDeleting(null)}
        onConfirm={() => void removeOpportunity()}
      />
    </div>
  );
}
