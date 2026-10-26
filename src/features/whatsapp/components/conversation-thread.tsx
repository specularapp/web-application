"use client";

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  CaretDownIcon,
  ChatsCircleIcon,
  ChatTextIcon,
  CheckCircleIcon,
  DotsThreeIcon,
  FunnelIcon,
  LockSimpleIcon,
  LockSimpleOpenIcon,
  PushPinIcon,
  SidebarSimpleIcon,
  StarIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Listbox, type ListboxOption } from "@/components/ui/listbox";
import { firstName, formatDayDivider, formatFull, formatPhone, formatTime, groupByDay, statusLabels, windowOpen } from "../inbox";
import type { ConversationStatus, MessageQuote, QuickReply, TeamMember, WhatsappConversation, WhatsappMessage } from "../types";
import { Composer } from "./composer";
import { MessageBubble } from "./message-bubble";
import styles from "./thread.module.css";

/** Quão perto do fim a conversa ainda conta como "no fim": a mensagem nova desce junto. */
const BOTTOM_SLACK = 80;

const STATUS_ORDER: ConversationStatus[] = ["aberta", "aguardando", "resolvida"];

export type ConversationThreadProps = {
  conversation: WhatsappConversation;
  team: TeamMember[];
  now: string;
  listClosed: boolean;
  panelOpen: boolean;
  replyTo: MessageQuote | null;
  draft: string;
  quickReplies: QuickReply[];
  onBack: () => void;
  onToggleList: () => void;
  onTogglePanel: () => void;
  onPatch: (patch: Partial<WhatsappConversation>, notice?: string) => void;
  onMarkUnread: () => void;
  onReply: (message: WhatsappMessage) => void;
  onCancelReply: () => void;
  onDraft: (text: string) => void;
  onSend: (text: string, mode: "text" | "note", files: File[]) => void;
  onRetry: (message: WhatsappMessage) => void;
  onOpenTemplates: () => void;
};

/**
 * A conversa aberta: o cabeçalho com quem é, a janela de 24 horas e as ações (situação, responsável, favorita, mais
 * ações e a ficha), as mensagens por dia sobre o fundo pontilhado e o campo no pé.
 */
export function ConversationThread({
  conversation,
  team,
  now,
  listClosed,
  panelOpen,
  replyTo,
  draft,
  quickReplies,
  onBack,
  onToggleList,
  onTogglePanel,
  onPatch,
  onMarkUnread,
  onReply,
  onCancelReply,
  onDraft,
  onSend,
  onRetry,
  onOpenTemplates,
}: ConversationThreadProps) {
  const { contact } = conversation;
  const name = firstName(contact.name);
  const open = windowOpen(conversation.windowExpiresAt, now);
  const days = useMemo(() => groupByDay(conversation.messages), [conversation.messages]);
  const assignee = team.find((member) => member.id === conversation.assigneeId) ?? null;
  const scroller = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  // A conversa abre no fim e desce junto quando chega mensagem, a menos que a pessoa tenha subido para ler
  const lastId = conversation.messages.at(-1)?.id;
  const stickToBottom = useRef(true);
  useLayoutEffect(() => {
    const element = scroller.current;
    if (element && stickToBottom.current) element.scrollTop = element.scrollHeight;
  }, [conversation.id, lastId]);

  const onScroll = () => {
    const element = scroller.current;
    if (!element) return;
    const bottom = element.scrollHeight - element.scrollTop - element.clientHeight < BOTTOM_SLACK;
    stickToBottom.current = bottom;
    if (bottom !== atBottom) setAtBottom(bottom);
  };

  const windowHint = open && conversation.windowExpiresAt ? `Janela de 24 horas aberta até ${formatTime(conversation.windowExpiresAt)}` : "Janela de 24 horas fechada: só modelos aprovados";

  const assigneeOptions: ListboxOption<string>[] = [
    {
      value: "",
      label: "Sem responsável",
      media: (
        <span className={styles.noAssignee} aria-hidden="true">
          <UserIcon />
        </span>
      ),
    },
    ...team.map((member) => ({ value: member.id, label: member.name, caption: member.role, media: <Avatar name={member.name} seed={member.id} size="xs" /> })),
  ];

  return (
    <>
      <header className={styles.head}>
        <span className={styles.listToggle}>
          <IconButton label={listClosed ? "Mostrar a lista de conversas" : "Recolher a lista de conversas"} variant="ghost" size="sm" aria-pressed={listClosed} onClick={onToggleList}>
            <SidebarSimpleIcon mirrored />
          </IconButton>
        </span>
        <span className={styles.back}>
          <IconButton label="Voltar para a lista" variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeftIcon />
          </IconButton>
        </span>
        <Avatar name={contact.name} seed={contact.id} size="sm" />
        <span className={styles.name}>
          <span className={styles.title}>
            <strong>{contact.name}</strong>
            <Badge size="sm" tone={open ? "success" : "warning"} icon={open ? <LockSimpleOpenIcon /> : <LockSimpleIcon />} label={windowHint} title={windowHint} />
          </span>
          <span className={styles.meta}>{formatPhone(contact.phone)}</span>
        </span>

        <div className={styles.actions}>
          <span className={styles.optional}>
            <DropdownMenu
              label="Situação"
              triggerLabel={`Situação: ${statusLabels[conversation.status]}. Mudar`}
              searchable={false}
              triggerContent={
                <span className={styles.statusChip} data-status={conversation.status}>
                  <span className={styles.chipLabel}>{statusLabels[conversation.status]}</span>
                  <CaretDownIcon aria-hidden="true" />
                </span>
              }
              sections={[
                {
                  id: "situacao",
                  items: STATUS_ORDER.map((status) => ({
                    id: status,
                    label: statusLabels[status],
                    selected: conversation.status === status,
                    onSelect: () => onPatch({ status, ...(status === "resolvida" ? { waitingSince: null } : {}) }, `Conversa ${statusLabels[status].toLowerCase()}`),
                  })),
                },
              ]}
            />
          </span>
          <span className={`${styles.assignee} ${styles.optional}`} title={assignee ? `Responsável: ${assignee.name}` : "Sem responsável"}>
            <Listbox
              label="Responsável pela conversa"
              value={conversation.assigneeId ?? ""}
              options={assigneeOptions}
              iconOnly
              icon={assignee ? <Avatar name={assignee.name} seed={assignee.id} size="xs" /> : <UserIcon />}
              searchable
              searchPlaceholder="Buscar pessoa da equipe"
              emptyLabel="Ninguém da equipe com esse nome."
              onChange={(id) => {
                const member = team.find((item) => item.id === id);
                onPatch({ assigneeId: member?.id ?? null, ...(member ? { waitingSince: null } : {}) }, member ? `Responsável: ${firstName(member.name)}` : "Conversa sem responsável");
              }}
            />
          </span>
          <span className={styles.optional}>
            <IconButton
              label={conversation.starred ? "Tirar das favoritas" : "Favoritar a conversa"}
              variant="ghost"
              size="sm"
              className={styles.starToggle}
              aria-pressed={conversation.starred}
              onClick={() => onPatch({ starred: !conversation.starred })}
            >
              <StarIcon weight={conversation.starred ? "fill" : "regular"} />
            </IconButton>
          </span>
          <DropdownMenu
            label="Mais ações"
            triggerLabel="Mais ações da conversa"
            icon={<DotsThreeIcon />}
            size="sm"
            searchable={false}
            sections={[
              {
                id: "conversa",
                items: [
                  {
                    id: "fixar",
                    label: conversation.pinned ? "Desafixar" : "Fixar no topo",
                    icon: PushPinIcon,
                    onSelect: () => onPatch({ pinned: !conversation.pinned }, conversation.pinned ? "Conversa desafixada" : "Conversa fixada"),
                  },
                  { id: "nao-lida", label: "Marcar como não lida", icon: ChatsCircleIcon, onSelect: onMarkUnread },
                  conversation.status === "resolvida"
                    ? { id: "reabrir", label: "Reabrir conversa", icon: ChatsCircleIcon, onSelect: () => onPatch({ status: "aberta" }, "Conversa reaberta") }
                    : { id: "resolver", label: "Resolver conversa", icon: CheckCircleIcon, onSelect: () => onPatch({ status: "resolvida", waitingSince: null }, "Conversa resolvida") },
                ],
              },
              {
                id: "atendimento",
                items: [
                  { id: "modelo", label: "Enviar modelo aprovado", icon: ChatTextIcon, onSelect: onOpenTemplates },
                  { id: "funil", label: "Abrir o funil de vendas", icon: FunnelIcon, href: "/crm" },
                ],
              },
            ]}
          />
          <IconButton label={panelOpen ? "Esconder a ficha do contato" : "Mostrar a ficha do contato"} variant="ghost" size="sm" aria-pressed={panelOpen} onClick={onTogglePanel}>
            <SidebarSimpleIcon />
          </IconButton>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.messages} ref={scroller} onScroll={onScroll}>
          {days.length === 0 ? (
            <p className={styles.noMessages}>Nenhuma mensagem ainda. Envie um modelo aprovado para começar a conversa com {name}.</p>
          ) : (
            days.map((day) => (
              <section key={day.key} className={styles.dayGroup} aria-label={formatDayDivider(day.at, now)}>
                <div className={styles.day}>
                  <span title={formatFull(day.at).split(" às")[0]}>{formatDayDivider(day.at, now)}</span>
                </div>
                {day.items.map(({ message, first }) => (
                  <MessageBubble key={message.id} message={message} first={first} contactName={name} onReply={onReply} onRetry={onRetry} />
                ))}
              </section>
            ))
          )}
        </div>

        {!atBottom && (
          <span className={styles.toBottom}>
            <IconButton
              label="Ir para as mensagens mais recentes"
              variant="outline"
              size="sm"
              radius="md"
              onClick={() => {
                stickToBottom.current = true;
                setAtBottom(true);
                scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
              }}
            >
              <ArrowDownIcon />
            </IconButton>
          </span>
        )}
      </div>

      <Composer
        key={conversation.id}
        contactName={name}
        open={open}
        closedAt={conversation.windowExpiresAt}
        replyTo={replyTo}
        onCancelReply={onCancelReply}
        draft={draft}
        onDraft={onDraft}
        quickReplies={quickReplies}
        onSend={onSend}
        onOpenTemplates={onOpenTemplates}
      />
    </>
  );
}
