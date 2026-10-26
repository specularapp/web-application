"use client";

import {
  CameraIcon,
  CaretDownIcon,
  CheckIcon,
  ChecksIcon,
  ClockIcon,
  FileTextIcon,
  LockSimpleIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  NotePencilIcon,
  PushPinIcon,
  SidebarSimpleIcon,
  SlidersHorizontalIcon,
  StarIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useMemo, useState, type CSSProperties } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, type DropdownSection, type DropdownTrigger } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { TagDot } from "@/components/ui/tag-picker";
import { Text } from "@/components/ui/text";
import { Tooltip } from "@/components/ui/tooltip";
import { useTabList } from "@/hooks/use-tab-list";
import { whatsappPlain } from "../format";
import {
  activeFilterCount,
  awaitingTeam,
  filterInbox,
  formatFull,
  formatListTime,
  lastMessage,
  NO_FILTERS,
  seenUnanswered,
  statusLabels,
  type InboxFilters,
  type InboxPeriod,
  type InboxReply,
  type InboxTab,
  type InboxWindow,
} from "../inbox";
import { whatsappTagCatalog } from "../tags";
import type { ContactStage, ConversationStatus, TeamMember, WhatsappConversation, WhatsappMessage } from "../types";
import styles from "./inbox.module.css";

const MAIN_TABS: { value: InboxTab; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "nao-lidas", label: "Não lidas" },
  { value: "aguardando", label: "Aguardando" },
];

/** Os recortes menos usados ficam um clique adiante, no chip da seta. */
const MORE_TABS: { value: InboxTab; label: string }[] = [
  { value: "minhas", label: "Minhas" },
  { value: "favoritas", label: "Favoritas" },
  { value: "fixadas", label: "Fixadas" },
];

const TAB_VALUES = MAIN_TABS.map((item) => item.value);
const ALL_TABS: InboxTab[] = [...TAB_VALUES, ...MORE_TABS.map((item) => item.value)];

const periodOptions: [InboxPeriod, string][] = [
  ["qualquer", "Qualquer data"],
  ["hoje", "Hoje"],
  ["7d", "Últimos 7 dias"],
  ["30d", "Últimos 30 dias"],
];

const replyOptions: [InboxReply, string][] = [
  ["qualquer", "Todas"],
  ["sem-resposta", "Sem resposta"],
  ["respondida", "Respondidas"],
];

const windowOptions: [InboxWindow, string][] = [
  ["qualquer", "Todas"],
  ["aberta", "Aberta"],
  ["fechada", "Fechada"],
];

/* O botão de filtros vestido como o campo de busca ao lado. */
const FILTER_TRIGGER: DropdownTrigger = { variant: "outline", radius: "md", foreground: "var(--color-label-secondary)" };

const flip = <T,>(list: T[], value: T, on: boolean) => (on ? [...list, value] : list.filter((item) => item !== value));

const step = (index: number) => ({ "--i": index }) as CSSProperties;

function Ticks({ message }: { message: WhatsappMessage }) {
  if (message.author === "contact" || !message.status) return null;
  if (message.status === "failed") return <WarningCircleIcon weight="fill" data-failed="" aria-label="Não entregue" />;
  if (message.status === "sending") return <ClockIcon aria-label="Enviando" />;
  if (message.status === "sent") return <CheckIcon aria-label="Enviada" />;
  return <ChecksIcon data-read={message.status === "read" || undefined} aria-label={message.status === "read" ? "Lida" : "Entregue"} />;
}

/** O que a prévia diz da última mensagem: os ticks, o tipo e o texto. */
function Preview({ message }: { message: WhatsappMessage | null }) {
  if (!message) return <span>Sem mensagens</span>;
  const icon =
    message.kind === "note" ? (
      <LockSimpleIcon weight="fill" data-note="" aria-hidden="true" />
    ) : message.kind === "image" ? (
      <CameraIcon aria-hidden="true" />
    ) : message.kind === "audio" ? (
      <MicrophoneIcon aria-hidden="true" />
    ) : message.kind === "document" ? (
      <FileTextIcon aria-hidden="true" />
    ) : null;
  const label = message.text || (message.kind === "image" ? "Foto" : message.kind === "audio" ? "Áudio" : message.kind === "document" ? (message.attachment?.name ?? "Documento") : "");
  const prefix = message.author === "agent" && message.kind !== "note" && message.kind !== "template" ? "Você: " : "";
  return (
    <>
      <Ticks message={message} />
      {icon}
      <span>
        {prefix}
        {whatsappPlain(label)}
      </span>
    </>
  );
}

export type ConversationListProps = {
  conversations: WhatsappConversation[];
  team: TeamMember[];
  stages: ContactStage[];
  selectedId: string | null;
  tab: InboxTab;
  query: string;
  me: string;
  now: string;
  /** O texto parado no campo de cada conversa: a prévia mostra "Rascunho" no lugar da última mensagem. */
  drafts: Record<string, string>;
  /** A lista recolhida num trilho só com as fotos. */
  rail: boolean;
  onTab: (tab: InboxTab) => void;
  onQuery: (query: string) => void;
  onSelect: (id: string) => void;
  onExpand: () => void;
  onNewConversation: () => void;
};

/**
 * A lista de conversas: busca com o botão de filtros, os recortes em chips e, no topo, quem espera a equipe, do mais
 * antigo para o mais novo. Cada linha diz quem é, a última mensagem com os ticks, a hora e as não lidas.
 */
export function ConversationList({ conversations, team, stages, selectedId, tab, query, me, now, drafts, rail, onTab, onQuery, onSelect, onExpand, onNewConversation }: ConversationListProps) {
  const [filters, setFilters] = useState<InboxFilters>(NO_FILTERS);
  const patch = (next: Partial<InboxFilters>) => setFilters((current) => ({ ...current, ...next }));
  const active = activeFilterCount(filters);
  const counts = useMemo(
    () => Object.fromEntries(ALL_TABS.map((value) => [value, filterInbox(conversations, value, "", me, filters, now).length])) as Record<InboxTab, number>,
    [conversations, me, filters, now],
  );
  const visible = filterInbox(conversations, tab, query, me, filters, now);
  const usedTags = useMemo(() => whatsappTagCatalog.options.filter((tag) => conversations.some((item) => item.contact.tags.includes(tag.id))), [conversations]);
  const mainTab = TAB_VALUES.includes(tab) ? tab : "todas";
  const chips = useTabList(TAB_VALUES, mainTab, onTab);
  const moreActive = MORE_TABS.find((item) => item.value === tab);

  const filterSections: DropdownSection[] = [
    ...(active > 0 ? [{ id: "limpar", items: [{ id: "limpar", label: "Limpar filtros", icon: XIcon, onSelect: () => setFilters(NO_FILTERS) }] }] : []),
    {
      id: "periodo",
      label: "Última mensagem",
      items: periodOptions.map(([value, label]) => ({ id: `periodo-${value}`, label, selected: filters.period === value, keepOpen: true, onSelect: () => patch({ period: value }) })),
    },
    {
      id: "resposta",
      label: "Resposta",
      items: replyOptions.map(([value, label]) => ({ id: `resposta-${value}`, label, selected: filters.reply === value, keepOpen: true, onSelect: () => patch({ reply: value }) })),
    },
    {
      id: "conversa",
      label: "Conversa",
      items: [
        ...(Object.keys(statusLabels) as ConversationStatus[]).map((status) => ({
          kind: "toggle" as const,
          id: `situacao-${status}`,
          label: statusLabels[status],
          checked: filters.status.includes(status),
          onChange: (on: boolean) => setFilters((current) => ({ ...current, status: flip(current.status, status, on) })),
        })),
        { kind: "toggle" as const, id: "fixadas", label: "Só fixadas", icon: PushPinIcon, checked: filters.pinnedOnly, onChange: (on: boolean) => patch({ pinnedOnly: on }) },
      ],
    },
    {
      id: "janela",
      label: "Janela de 24 horas",
      items: windowOptions.map(([value, label]) => ({ id: `janela-${value}`, label, selected: filters.window === value, keepOpen: true, onSelect: () => patch({ window: value }) })),
    },
    {
      id: "responsavel",
      label: "Responsável",
      items: [...team.map((member) => ({ id: member.id, name: member.name })), { id: "", name: "Sem responsável" }].map((member) => ({
        kind: "toggle" as const,
        id: `responsavel-${member.id || "nenhum"}`,
        label: member.name,
        media: member.id ? <Avatar name={member.name} seed={member.id} size="xs" /> : undefined,
        checked: filters.assignees.includes(member.id),
        onChange: (on: boolean) => setFilters((current) => ({ ...current, assignees: flip(current.assignees, member.id, on) })),
      })),
    },
    {
      id: "etapa",
      label: "Etapa do funil",
      items: stages.map((stage) => ({
        kind: "toggle" as const,
        id: `etapa-${stage.id}`,
        label: stage.label,
        media: <TagDot hue={stage.hue} />,
        checked: filters.stages.includes(stage.id),
        onChange: (on: boolean) => setFilters((current) => ({ ...current, stages: flip(current.stages, stage.id, on) })),
      })),
    },
    ...(usedTags.length > 0
      ? [
          {
            id: "etiquetas",
            label: "Etiquetas",
            items: usedTags.map((tag) => ({
              kind: "toggle" as const,
              id: `etiqueta-${tag.id}`,
              label: tag.id,
              media: <TagDot hue={tag.hue} />,
              checked: filters.tags.includes(tag.id),
              onChange: (on: boolean) => setFilters((current) => ({ ...current, tags: flip(current.tags, tag.id, on) })),
            })),
          },
        ]
      : []),
  ];

  const waiting = visible.filter(awaitingTeam).toSorted((a, b) => (a.waitingSince ?? "").localeCompare(b.waitingSince ?? ""));
  const pinned = visible.filter((item) => item.pinned && !awaitingTeam(item));
  const rest = visible.filter((item) => !item.pinned && !awaitingTeam(item));

  const row = (conversation: WhatsappConversation, index: number) => {
    const { contact } = conversation;
    const last = lastMessage(conversation);
    const unread = conversation.unread > 0;
    const draft = drafts[conversation.id];
    const name = rail ? `${contact.name}${unread ? `, ${conversation.unread} não lidas` : ""}` : undefined;
    return (
      <li key={conversation.id} className={styles.itemEnter} style={step(index)}>
        <button
          type="button"
          className={styles.item}
          data-selected={selectedId === conversation.id || undefined}
          data-unread={unread || undefined}
          aria-current={selectedId === conversation.id || undefined}
          aria-label={name}
          title={rail ? contact.name : undefined}
          onClick={() => onSelect(conversation.id)}
        >
          <span className={styles.itemAvatar}>
            <Avatar name={contact.name} seed={contact.id} size="sm" />
            {rail && unread && <b className={styles.railUnread}>{conversation.unread > 99 ? "99+" : conversation.unread}</b>}
          </span>
          <span className={styles.itemText}>
            <span className={styles.itemRow}>
              <strong className={styles.itemName}>
                {awaitingTeam(conversation) && (
                  <Badge size="sm" tone="accent">
                    Novo
                  </Badge>
                )}
                <span>{contact.name}</span>
              </strong>
              {last && (
                <time dateTime={last.at} title={formatFull(last.at)}>
                  {formatListTime(last.at, now)}
                </time>
              )}
            </span>
            <span className={styles.itemRow}>
              <span className={styles.preview}>
                {draft && selectedId !== conversation.id ? (
                  <span>
                    <em className={styles.draftLabel}>Rascunho:</em> {draft}
                  </span>
                ) : (
                  <Preview message={last} />
                )}
              </span>
              <span className={styles.itemFlags}>
                {seenUnanswered(conversation) && (
                  <Badge size="sm" tone="warning" variant="outline">
                    Sem resposta
                  </Badge>
                )}
                {conversation.starred && <StarIcon weight="fill" data-star="" aria-label="Favorita" />}
                {conversation.pinned && <PushPinIcon weight="fill" aria-label="Fixada" />}
                {unread && (
                  <Badge size="sm" tone="success" variant="solid" shape="pill" aria-label={`${conversation.unread} não lidas`}>
                    {conversation.unread}
                  </Badge>
                )}
              </span>
            </span>
          </span>
        </button>
      </li>
    );
  };

  const filtered = active > 0 || query.trim().length > 0;

  return (
    <aside className={styles.list} aria-label="Conversas" data-rail={rail || undefined}>
      {rail && (
        <div className={styles.railHead}>
          <IconButton label="Mostrar a lista de conversas" variant="ghost" size="sm" onClick={onExpand}>
            <SidebarSimpleIcon mirrored />
          </IconButton>
        </div>
      )}
      <div className={styles.listHead}>
        <div className={styles.titleRow}>
          <Text as="h2" variant="title3" weight="semibold">
            Conversas
          </Text>
          <Tooltip content="Nova conversa">
            <IconButton label="Nova conversa pelo número" variant="outline" size="sm" radius="md" onClick={onNewConversation}>
              <NotePencilIcon />
            </IconButton>
          </Tooltip>
        </div>
        <div className={styles.searchRow}>
          <Input type="search" size="sm" value={query} placeholder="Buscar conversa" aria-label="Buscar conversa" iconStart={<MagnifyingGlassIcon />} onChange={(event) => onQuery(event.target.value)} />
          <span className={styles.filterButton}>
            <DropdownMenu label="Filtros" triggerLabel={active > 0 ? `Filtros, ${active} em vigor` : "Filtrar conversas"} sections={filterSections} icon={<SlidersHorizontalIcon />} size="sm" trigger={FILTER_TRIGGER} searchable={false} />
            {active > 0 && (
              <Badge tone="accent" variant="solid" size="sm" shape="pill" className={styles.filterCount} aria-hidden="true">
                {active}
              </Badge>
            )}
          </span>
        </div>

        <div className={styles.chips}>
          <div className={styles.chipGroup} aria-label="Recortes" {...chips.listProps}>
            {MAIN_TABS.map((item) => (
              <button key={item.value} type="button" className={styles.chip} data-pressed={tab === item.value || undefined} {...{ ...chips.tabProps(item.value), "aria-selected": tab === item.value }} onClick={() => onTab(item.value)}>
                {item.label}
                {item.value !== "todas" && counts[item.value] > 0 && <span className={styles.chipCount}>{counts[item.value]}</span>}
              </button>
            ))}
          </div>
          <DropdownMenu
            label="Mais recortes"
            triggerLabel={moreActive ? `Recorte: ${moreActive.label}` : "Mais recortes"}
            searchable={false}
            triggerContent={
              <span className={styles.chip} data-pressed={moreActive ? "" : undefined}>
                {moreActive?.label}
                <CaretDownIcon aria-hidden="true" />
              </span>
            }
            sections={[
              {
                id: "mais",
                items: MORE_TABS.map((item) => ({ id: item.value, label: item.label, count: counts[item.value], selected: tab === item.value, onSelect: () => onTab(tab === item.value ? "todas" : item.value) })),
              },
            ]}
          />
        </div>
      </div>

      <div className={styles.listBody}>
        {visible.length === 0 && (
          <p className={styles.listEmpty}>
            {filtered ? "Nenhuma conversa com esses filtros." : "Nenhuma conversa neste recorte."}
            {active > 0 && (
              <button type="button" className={styles.linkButton} onClick={() => setFilters(NO_FILTERS)}>
                Limpar filtros
              </button>
            )}
          </p>
        )}
        {waiting.length > 0 && (
          <section aria-label="Aguardando a equipe">
            <h3 className={styles.groupTitle}>
              Aguardando a equipe
              <Badge size="sm" shape="pill">
                {waiting.length}
              </Badge>
            </h3>
            <ul className={styles.rows}>{waiting.map((item, index) => row(item, index))}</ul>
          </section>
        )}
        {pinned.length > 0 && (
          <section aria-label="Fixadas">
            <h3 className={styles.groupTitle} style={step(waiting.length)}>
              Fixadas
            </h3>
            <ul className={styles.rows}>{pinned.map((item, index) => row(item, waiting.length + index))}</ul>
          </section>
        )}
        {rest.length > 0 && (
          <section aria-label="Recentes">
            <h3 className={styles.groupTitle} style={step(waiting.length + pinned.length)}>
              Recentes
            </h3>
            <ul className={styles.rows}>{rest.map((item, index) => row(item, waiting.length + pinned.length + index))}</ul>
          </section>
        )}
      </div>
    </aside>
  );
}
