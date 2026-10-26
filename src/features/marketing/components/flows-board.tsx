"use client";

import { ArrowCounterClockwiseIcon, CaretDownIcon, ChatCircleTextIcon, CopyIcon, DotsThreeIcon, FolderIcon, LightningIcon, PauseIcon, PencilSimpleIcon, PlayIcon, PlusIcon, TrashIcon, XIcon, type Icon } from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState, type CSSProperties } from "react";
import { PageToolbar, type PageToolbarFilter } from "@/components/layout/page-toolbar";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, DataTableTitle, type DataTableColumn, type DataTableSort } from "@/components/ui/data-table";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { useOpenedOnce } from "@/hooks/use-opened-once";
import { slugify } from "@/lib/utils/slug";
import { formatCount, formatRate, formatWhen, ratio } from "../email-catalog";
import { flowChannels, flowStatuses, flowTriggers, newFlowId, summarizeFlow } from "../flow-catalog";
import type { Flow, FlowChannel, FlowStatus } from "../types";
import { channelIcons } from "./icons";
import { NewFlowDialog } from "./new-flow-dialog";
import styles from "./flows-board.module.css";

const BASE = "/marketing/fluxos";

const SEARCH_LIMIT = 400;

type StatusFilter = FlowStatus | "todos";

const statusFilters: { value: StatusFilter; label: string; icon: Icon }[] = [
  { value: "todos", label: "Todos", icon: LightningIcon },
  { value: "live", label: "No ar", icon: PlayIcon },
  { value: "paused", label: "Pausados", icon: PauseIcon },
  { value: "draft", label: "Rascunhos", icon: PencilSimpleIcon },
];

export type FlowsBoardProps = { flows: Flow[]; author: string };

// A lista de fluxos de conversa (2026-10-25, a partir do construtor estilo ManyChat do Le Ange): o resumo do
// mês, a barra de busca e filtros da casa e a tabela, em que cada linha diz o que dispara, por onde fala, se
// está no ar (o interruptor liga e pausa ali mesmo) e como foi nos últimos 30 dias. Abrir leva ao construtor,
// que é uma tela. Tudo vive no estado desta tela até o domínio ir para o banco.
export function FlowsBoard({ flows: initial, author }: FlowsBoardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [flows, setFlows] = useState(initial);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [folders, setFolders] = useState<string[]>([]);
  const [channels, setChannels] = useState<FlowChannel[]>([]);
  const [sort, setSort] = useState<DataTableSort | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Flow[] | null>(null);
  const createReady = useOpenedOnce(creating);

  const summaries = useMemo(() => new Map(flows.map((flow) => [flow.id, summarizeFlow(flow)])), [flows]);
  const summaryOf = (flow: Flow) => summaries.get(flow.id) ?? summarizeFlow(flow);
  const folderList = useMemo(() => [...new Set(flows.map((flow) => flow.folder))].toSorted(), [flows]);
  const term = slugify(search, SEARCH_LIMIT);
  const filtering = Boolean(term) || status !== "todos" || folders.length > 0 || channels.length > 0;

  const visible = useMemo(() => {
    const matching = flows.filter((flow) => {
      const summary = summaries.get(flow.id);
      const haystack = `${flow.name} ${flow.folder} ${(summary?.triggers ?? []).map((kind) => flowTriggers[kind].label).join(" ")}`;
      return (
        (!term || slugify(haystack, SEARCH_LIMIT).includes(term)) &&
        (status === "todos" || flow.status === status) &&
        (folders.length === 0 || folders.includes(flow.folder)) &&
        (channels.length === 0 || (summary?.channels ?? []).some((channel) => channels.includes(channel)))
      );
    });
    const values: Record<string, (flow: Flow) => number | string> = {
      name: (flow) => flow.name,
      success: (flow) => (flow.entered ? flow.completed / flow.entered : -1),
      entered: (flow) => flow.entered,
      sent: (flow) => summaries.get(flow.id)?.sent ?? 0,
      ctr: (flow) => {
        const summary = summaries.get(flow.id);
        return summary && summary.sent ? summary.clicked / summary.sent : -1;
      },
      updated: (flow) => flow.updatedAt,
    };
    const by = values[sort?.column ?? "updated"] ?? values.updated;
    const direction = sort?.direction === "asc" ? 1 : -1;
    return matching.toSorted((a, b) => {
      const left = by(a);
      const right = by(b);
      return (typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), "pt-BR")) * direction;
    });
  }, [flows, summaries, term, status, folders, channels, sort]);

  const clearAll = () => {
    setSearch("");
    setStatus("todos");
    setFolders([]);
    setChannels([]);
  };

  const setFlowStatus = (targets: Flow[], next: FlowStatus) => {
    const ids = new Set(targets.map((flow) => flow.id));
    setFlows((current) => current.map((flow) => (ids.has(flow.id) ? { ...flow, status: next } : flow)));
  };

  const toggle = (flow: Flow, on: boolean) => {
    setFlowStatus([flow], on ? "live" : "paused");
    toast({ title: on ? "Fluxo no ar" : "Fluxo pausado", description: on ? `${flow.name} volta a receber contatos.` : "Ninguém novo entra; quem está no meio para onde está.", tone: on ? "success" : "neutral", feedback: false });
  };

  const toggleMany = (on: boolean) => {
    const targets = flows.filter((flow) => selected.includes(flow.id) && flow.status !== "draft" && (flow.status === "live") !== on);
    if (targets.length === 0) {
      toast({ title: on ? "Nada para pôr no ar" : "Nada para pausar", description: "Rascunhos vão ao ar quando publicados no construtor.", tone: "info" });
      return;
    }
    setFlowStatus(targets, on ? "live" : "paused");
    setSelected([]);
    toast({ title: on ? `${targets.length} no ar` : `${targets.length} pausados`, description: on ? "Já recebem contatos." : "Param de receber contatos.", tone: on ? "success" : "neutral", feedback: false });
  };

  const duplicate = (flow: Flow) => {
    const copy: Flow = { ...flow, id: `fl-${newFlowId()}`, name: `${flow.name} (cópia)`, status: "draft", publishedAt: null, entered: 0, completed: 0, stats: {}, createdBy: author };
    setFlows((current) => [copy, ...current]);
    toast({ title: "Fluxo duplicado", description: "A cópia nasceu como rascunho, fora do ar.", tone: "success", feedback: false });
  };

  const remove = () => {
    if (!removing) return;
    const ids = new Set(removing.map((flow) => flow.id));
    setFlows((current) => current.filter((flow) => !ids.has(flow.id)));
    setSelected((current) => current.filter((id) => !ids.has(id)));
    toast({ title: removing.length === 1 ? "Fluxo excluído" : `${removing.length} fluxos excluídos`, description: "Saíram do ar e da lista, com os passos e os números.", tone: "neutral" });
    setRemoving(null);
  };

  const columns: DataTableColumn<Flow>[] = [
    {
      id: "name",
      header: "Fluxo",
      width: "17rem",
      sortable: true,
      cell: (flow) => {
        const trigger = summaryOf(flow).triggers[0];
        return <DataTableTitle title={flow.name} caption={trigger ? `${flowTriggers[trigger].label}, ${flow.folder}` : `Sem gatilho, ${flow.folder}`} href={`${BASE}/${flow.id}` as Route} />;
      },
    },
    {
      id: "channels",
      header: "Canais",
      hideBelow: "md",
      cell: (flow) => {
        const list = summaryOf(flow).channels;
        return list.length === 0 ? (
          <Badge size="sm">Nenhum</Badge>
        ) : (
          <span className={styles.channels}>
            {list.map((channel) => {
              const Glyph = channelIcons[channel];
              return (
                <span key={channel} className={styles.channel} style={{ "--hue": flowChannels[channel].hue } as CSSProperties}>
                  <Glyph weight="fill" aria-hidden="true" />
                  {flowChannels[channel].label}
                </span>
              );
            })}
          </span>
        );
      },
    },
    {
      id: "status",
      header: "Situação",
      cell: (flow) => (
        <Badge tone={flowStatuses[flow.status].tone} size="sm">
          {flowStatuses[flow.status].label}
        </Badge>
      ),
    },
    {
      id: "success",
      header: "Sucesso",
      sortable: true,
      hideBelow: "md",
      cell: (flow) => {
        if (flow.entered === 0) return <Badge size="sm">Ninguém entrou</Badge>;
        const share = ratio(flow.completed, flow.entered);
        return (
          <span className={styles.success} data-level={share >= 75 ? "alto" : share >= 50 ? "medio" : "baixo"} title={`${formatCount(flow.completed)} de ${formatCount(flow.entered)} chegaram ao fim do fluxo`}>
            <span className={styles.successBar} aria-hidden="true">
              <i style={{ width: `${share}%` }} />
            </span>
            <span className={styles.successText}>
              <strong>{formatRate(flow.completed, flow.entered)}</strong>
              <small>
                {formatCount(flow.completed)}/{formatCount(flow.entered)}
              </small>
            </span>
          </span>
        );
      },
    },
    { id: "entered", header: "Entraram", align: "end", sortable: true, hideBelow: "lg", cell: (flow) => <span className={styles.number}>{formatCount(flow.entered)}</span> },
    { id: "sent", header: "Mensagens", align: "end", sortable: true, hideBelow: "lg", cell: (flow) => <span className={styles.number}>{formatCount(summaryOf(flow).sent)}</span> },
    {
      id: "ctr",
      header: "CTR",
      align: "end",
      sortable: true,
      hideBelow: "md",
      cell: (flow) => {
        const summary = summaryOf(flow);
        return summary.sent > 0 && summary.clicked > 0 ? <span className={styles.number}>{formatRate(summary.clicked, summary.sent)}</span> : <Badge size="sm">Sem cliques</Badge>;
      },
    },
    {
      id: "creator",
      header: "Criado por",
      hideBelow: "lg",
      cell: (flow) => (
        <span className={styles.person}>
          <Avatar name={flow.createdBy} size="xs" aria-hidden="true" />
          <Text as="span" variant="footnote" truncate>
            {flow.createdBy.split(" ")[0]}
          </Text>
        </span>
      ),
    },
    { id: "updated", header: "Atualizado", sortable: true, hideBelow: "lg", cell: (flow) => <span className={styles.muted}>{formatWhen(flow.updatedAt)}</span> },
    {
      id: "active",
      header: "No ar",
      align: "end",
      cell: (flow) =>
        flow.status === "draft" ? (
          <Badge size="sm">Rascunho</Badge>
        ) : (
          <Switch size="sm" checked={flow.status === "live"} onChange={(event) => toggle(flow, event.target.checked)} aria-label={`${flow.status === "live" ? "Pausar" : "Pôr no ar"} ${flow.name}`} />
        ),
    },
  ];

  const menu = (flow: Flow): DropdownSection[] => [
    {
      id: "abrir",
      items: [
        { id: "abrir", label: "Abrir no construtor", icon: PencilSimpleIcon, href: `${BASE}/${flow.id}` as Route },
        { id: "duplicar", label: "Duplicar", icon: CopyIcon, onSelect: () => duplicate(flow) },
        ...(flow.status === "draft" ? [] : [{ id: "situacao", label: flow.status === "live" ? "Pausar" : "Pôr no ar", icon: flow.status === "live" ? PauseIcon : PlayIcon, onSelect: () => toggle(flow, flow.status !== "live") }]),
      ],
    },
    { id: "perigo", items: [{ id: "excluir", label: "Excluir", icon: TrashIcon, tone: "danger" as const, onSelect: () => setRemoving([flow]) }] },
  ];

  const filterSections: DropdownSection[] = [
    { id: "situacao", label: "Situação", items: statusFilters.map((option) => ({ id: `situacao-${option.value}`, label: option.label, icon: option.icon, selected: status === option.value, keepOpen: true, onSelect: () => setStatus(option.value) })) },
    {
      id: "canal",
      label: "Canal",
      items: (Object.keys(flowChannels) as FlowChannel[]).map((channel) => ({ kind: "toggle" as const, id: `canal-${channel}`, label: flowChannels[channel].label, icon: channelIcons[channel], checked: channels.includes(channel), onChange: (checked: boolean) => setChannels((current) => (checked ? [...current, channel] : current.filter((item) => item !== channel))) })),
    },
    {
      id: "pasta",
      label: "Pasta",
      items: folderList.map((folder) => ({ kind: "toggle" as const, id: `pasta-${folder}`, label: folder, icon: FolderIcon, checked: folders.includes(folder), onChange: (checked: boolean) => setFolders((current) => (checked ? [...current, folder] : current.filter((item) => item !== folder))) })),
    },
    ...(status !== "todos" || folders.length > 0 || channels.length > 0 ? [{ id: "limpar", items: [{ id: "limpar", label: "Limpar filtros", icon: ArrowCounterClockwiseIcon, onSelect: () => {
              setStatus("todos");
              setFolders([]);
              setChannels([]);
            } }] }] : []),
  ];

  const activeFilters: PageToolbarFilter[] = [
    ...(status !== "todos" ? [{ id: "situacao", label: flowStatuses[status].label, icon: LightningIcon, onClear: () => setStatus("todos") }] : []),
    ...channels.map((channel) => ({ id: `canal-${channel}`, label: flowChannels[channel].label, icon: channelIcons[channel], onClear: () => setChannels((current) => current.filter((item) => item !== channel)) })),
    ...folders.map((folder) => ({ id: `pasta-${folder}`, label: folder, icon: FolderIcon, onClear: () => setFolders((current) => current.filter((item) => item !== folder)) })),
  ];

  const selectedFlows = visible.filter((flow) => selected.includes(flow.id));
  const live = flows.filter((flow) => flow.status === "live");
  const entered = flows.reduce((sum, flow) => sum + flow.entered, 0);
  const completed = flows.reduce((sum, flow) => sum + flow.completed, 0);
  const sent = flows.reduce((sum, flow) => sum + summaryOf(flow).sent, 0);
  const clicked = flows.reduce((sum, flow) => sum + summaryOf(flow).clicked, 0);
  const tiles = [
    { id: "ar", label: "No ar", value: formatCount(live.length), caption: `de ${formatCount(flows.length)} fluxos` },
    { id: "entraram", label: "Entraram em 30 dias", value: formatCount(entered), caption: `${formatCount(completed)} chegaram ao fim` },
    { id: "mensagens", label: "Mensagens enviadas", value: formatCount(sent), caption: `${formatCount(clicked)} cliques em botões` },
    { id: "conclusao", label: "Taxa de conclusão", value: formatRate(completed, entered), caption: "Do gatilho ao último passo" },
  ];

  return (
    <div className={styles.board}>
      <PageToolbar
        search={{ value: search, onChange: setSearch, placeholder: "Buscar nome, gatilho ou pasta", label: "Buscar fluxo" }}
        filters={filterSections}
        activeFilters={activeFilters}
        selection={
          selectedFlows.length > 0 ? (
            <DropdownMenu
              label="Ações da seleção"
              triggerLabel={`Opções para ${selectedFlows.length} ${selectedFlows.length === 1 ? "fluxo selecionado" : "fluxos selecionados"}`}
              searchable={false}
              trigger={{ variant: "outline", radius: "md" }}
              triggerContent={
                <span className={styles.bulk}>
                  Opções
                  <Badge size="sm" tone="accent">
                    {selectedFlows.length}
                  </Badge>
                  <CaretDownIcon aria-hidden="true" />
                </span>
              }
              sections={[
                {
                  id: "situacao",
                  label: `${selectedFlows.length} ${selectedFlows.length === 1 ? "selecionado" : "selecionados"}`,
                  items: [
                    { id: "ativar", label: "Pôr no ar", icon: PlayIcon, onSelect: () => toggleMany(true) },
                    { id: "pausar", label: "Pausar", icon: PauseIcon, onSelect: () => toggleMany(false) },
                    { id: "limpar", label: "Limpar seleção", icon: XIcon, onSelect: () => setSelected([]) },
                  ],
                },
                { id: "perigo", items: [{ id: "excluir", label: "Excluir", icon: TrashIcon, tone: "danger", onSelect: () => setRemoving(selectedFlows) }] },
              ]}
            />
          ) : undefined
        }
        action={
          <>
            <span className={styles.wide}>
              <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => setCreating(true)}>
                Novo fluxo
              </Button>
            </span>
            <span className={styles.narrow}>
              <IconButton label="Novo fluxo" size="sm" radius="md" onClick={() => setCreating(true)}>
                <PlusIcon />
              </IconButton>
            </span>
          </>
        }
      />

      <ul className={styles.summary} aria-label="Resumo dos fluxos">
        {tiles.map((tile) => (
          <li key={tile.id} className={styles.tile}>
            <span className={styles.tileLabel}>{tile.label}</span>
            <strong className={styles.tileValue}>{tile.value}</strong>
            <small className={styles.tileCaption}>{tile.caption}</small>
          </li>
        ))}
      </ul>

      <div className={styles.content}>
        <DataTable
          label="Fluxos"
          columns={columns}
          rows={visible}
          rowKey={(flow) => flow.id}
          density="compact"
          fill
          sort={sort}
          onSortChange={setSort}
          selection={{ selected, onChange: setSelected, rowLabel: (flow) => `Selecionar ${flow.name}` }}
          onRowClick={(flow) => router.push(`${BASE}/${flow.id}` as Route)}
          actions={(flow) => <DropdownMenu label={`Ações de ${flow.name}`} triggerLabel={`Mais ações de ${flow.name}`} icon={<DotsThreeIcon />} size="sm" searchable={false} sections={menu(flow)} />}
          footer={
            <Text as="span" variant="caption1" tone="tertiary">
              Os números são dos últimos 30 dias
            </Text>
          }
          empty={
            <EmptyState
              icon={ChatCircleTextIcon}
              title={filtering ? "Nenhum fluxo encontrado" : "Nenhum fluxo ainda"}
              description={filtering ? "Nada bateu com a busca e os filtros. Tente outro nome ou limpe tudo." : "Comece por um modelo pronto, como o comentário que vira direct, e ajuste no construtor."}
              size="sm"
            >
              {filtering && (
                <Button variant="secondary" size="sm" radius="md" iconStart={<ArrowCounterClockwiseIcon />} onClick={clearAll}>
                  Limpar busca
                </Button>
              )}
              <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => setCreating(true)}>
                Novo fluxo
              </Button>
            </EmptyState>
          }
        />
      </div>

      {createReady && <NewFlowDialog open={creating} onClose={() => setCreating(false)} />}

      <ConfirmDialog
        open={removing !== null}
        title={removing && removing.length > 1 ? `Excluir ${removing.length} fluxos?` : "Excluir este fluxo?"}
        description={removing && removing.length === 1 ? `“${removing[0].name}” sai do ar e some da lista, com os passos e os números.` : "Eles saem do ar e somem da lista, com os passos e os números."}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
      />
    </div>
  );
}
