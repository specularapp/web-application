"use client";

import { ChatsCircleIcon, NotePencilIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { byLastMessage, fillTemplate, firstName, formatPhone, type InboxTab } from "../inbox";
import type { DeliveryStatus, MessageKind, MessageQuote, MessageTemplate, WhatsappContact, WhatsappConversation, WhatsappMessage, WhatsappSample } from "../types";
import { ContactPanel } from "./contact-panel";
import { ConversationList } from "./conversation-list";
import { ConversationThread } from "./conversation-thread";
import styles from "./inbox.module.css";
import { NewConversationDialog, type NewConversationInput } from "./new-conversation-dialog";
import { TemplateDialog } from "./template-dialog";

/** Onde cabem lista, conversa e ficha lado a lado: a ficha abre sozinha na primeira conversa. */
const WIDE_QUERY = "(min-width: 90.0625rem)";

/** Quanto a mensagem de exemplo leva para passar de enviando a enviada e de enviada a entregue. */
const SENT_AFTER = 700;
const DELIVERED_AFTER = 1800;

const kindOf = (file: File): MessageKind => (file.type.startsWith("image/") || file.type.startsWith("video/") ? "image" : file.type.startsWith("audio/") ? "audio" : "document");

let sequence = 0;
const localId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(sequence++).toString(36)}`;

const quoteOf = (message: WhatsappMessage): MessageQuote => ({ id: message.id, text: message.text, author: message.author, kind: message.kind });

export type WhatsappInboxProps = { sample: WhatsappSample };

/**
 * A caixa de entrada: a lista, a conversa aberta e a ficha do contato. Tudo o que acontece aqui fica na tela, sobre os
 * dados de exemplo: enviar, mudar a situação, fixar ou trocar o responsável não sai para o WhatsApp nem para o banco.
 */
export function WhatsappInbox({ sample }: WhatsappInboxProps) {
  const { toast } = useToast();
  const { now, me, team, stages, templates } = sample;
  const meName = team.find((member) => member.id === me)?.name ?? "Você";
  const [conversations, setConversations] = useState(sample.conversations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<InboxTab>("todas");
  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const panelChosen = useRef(false);
  const [listClosed, setListClosed] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<MessageQuote | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const sorted = useMemo(() => conversations.toSorted(byLastMessage), [conversations]);
  const current = conversations.find((conversation) => conversation.id === selectedId) ?? null;

  const patch = (id: string, change: (conversation: WhatsappConversation) => WhatsappConversation) =>
    setConversations((list) => list.map((conversation) => (conversation.id === id ? change(conversation) : conversation)));

  const later = (delay: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, delay));
  };

  const setStatus = (conversationId: string, messageId: string, status: DeliveryStatus) =>
    patch(conversationId, (conversation) => ({ ...conversation, messages: conversation.messages.map((message) => (message.id === messageId ? { ...message, status } : message)) }));

  /** A mensagem entra na conversa enviando e anda sozinha até entregue, como faria com o WhatsApp de verdade. */
  const deliver = (conversationId: string, messageIds: string[]) => {
    later(SENT_AFTER, () => messageIds.forEach((id) => setStatus(conversationId, id, "sent")));
    later(DELIVERED_AFTER, () => messageIds.forEach((id) => setStatus(conversationId, id, "delivered")));
  };

  const append = (conversationId: string, messages: WhatsappMessage[]) =>
    patch(conversationId, (conversation) => ({
      ...conversation,
      messages: [...conversation.messages, ...messages],
      unread: 0,
      ...(messages.some((message) => message.kind !== "note") ? { status: "aberta" as const, waitingSince: null, assigneeId: conversation.assigneeId ?? me } : {}),
    }));

  const select = (id: string) => {
    setSelectedId(id);
    setReplyTo(null);
    if (!panelChosen.current && window.matchMedia(WIDE_QUERY).matches) setPanelOpen(true);
    patch(id, (conversation) => (conversation.unread > 0 ? { ...conversation, unread: 0 } : conversation));
  };

  const send = (text: string, mode: "text" | "note", files: File[]) => {
    if (!current) return;
    const at = new Date().toISOString();
    const base = { author: "agent" as const, authorName: meName, at };
    const outgoing: WhatsappMessage[] =
      mode === "note"
        ? [{ ...base, id: localId("nota"), kind: "note", text }]
        : [
            ...files.map((file): WhatsappMessage => ({ ...base, id: localId("arquivo"), kind: kindOf(file), text: "", status: "sending", attachment: { name: file.name, size: file.size } })),
            ...(text ? [{ ...base, id: localId("mensagem"), kind: "text" as const, text, status: "sending" as const, ...(replyTo ? { replyTo } : {}) }] : []),
          ];
    append(current.id, outgoing);
    setReplyTo(null);
    setDrafts((list) => ({ ...list, [current.id]: "" }));
    if (mode !== "note") deliver(current.id, outgoing.map((message) => message.id));
  };

  const sendTemplate = (conversationId: string, template: MessageTemplate, values: string[]) => {
    const message: WhatsappMessage = {
      id: localId("modelo"),
      author: "agent",
      authorName: template.name,
      kind: "template",
      text: fillTemplate(template.body, values),
      at: new Date().toISOString(),
      status: "sending",
      template: { header: template.header, footer: template.footer, buttons: template.buttons },
    };
    append(conversationId, [message]);
    deliver(conversationId, [message.id]);
  };

  const retry = (message: WhatsappMessage) => {
    if (!current) return;
    setStatus(current.id, message.id, "sending");
    deliver(current.id, [message.id]);
  };

  const notify = (title: string) => toast({ title, description: "Alteração feita na tela, sobre os dados de exemplo.", tone: "info", feedback: false });

  const startConversation = ({ phone, name, template, values }: NewConversationInput) => {
    const id = localId("conversa");
    const at = new Date().toISOString();
    const contact: WhatsappContact = { id: localId("contato"), name: name || formatPhone(phone), phone, tags: [], source: "organico", stage: "novo", createdAt: at };
    const conversation: WhatsappConversation = {
      id,
      contact,
      status: "aberta",
      assigneeId: me,
      unread: 0,
      pinned: false,
      starred: false,
      waitingSince: null,
      windowExpiresAt: null,
      messages: [],
    };
    setConversations((list) => [conversation, ...list]);
    sendTemplate(id, template, values);
    setNewOpen(false);
    setTab("todas");
    setQuery("");
    select(id);
    toast({ title: "Conversa aberta", description: "O modelo saiu. Quando o contato responder, a janela de 24 horas abre.", tone: "success", feedback: false });
  };

  const quickReplies = useMemo(() => (current ? sample.quickReplies.map((reply) => ({ ...reply, text: reply.text.replaceAll("{nome}", firstName(current.contact.name)) })) : []), [current, sample.quickReplies]);

  return (
    <div className={styles.screen} data-open={current ? "" : undefined} data-panel={(panelOpen && current) || undefined} data-list={listClosed && current ? "closed" : undefined}>
      <ConversationList
        conversations={sorted}
        team={team}
        stages={stages}
        selectedId={selectedId}
        tab={tab}
        query={query}
        me={me}
        now={now}
        drafts={drafts}
        rail={listClosed && Boolean(current)}
        onTab={setTab}
        onQuery={setQuery}
        onSelect={select}
        onExpand={() => setListClosed(false)}
        onNewConversation={() => setNewOpen(true)}
      />

      <section className={styles.thread} aria-label={current ? `Conversa com ${current.contact.name}` : "Conversa"}>
        {current ? (
          <ConversationThread
            key={current.id}
            conversation={current}
            team={team}
            now={now}
            listClosed={listClosed}
            panelOpen={panelOpen}
            replyTo={replyTo}
            draft={drafts[current.id] ?? ""}
            quickReplies={quickReplies}
            onBack={() => setSelectedId(null)}
            onToggleList={() => setListClosed((value) => !value)}
            onTogglePanel={() => {
              panelChosen.current = true;
              setPanelOpen((value) => !value);
            }}
            onPatch={(change, notice) => {
              patch(current.id, (conversation) => ({ ...conversation, ...change }));
              if (notice) notify(notice);
            }}
            onMarkUnread={() => {
              patch(current.id, (conversation) => ({ ...conversation, unread: Math.max(1, conversation.unread) }));
              setSelectedId(null);
              notify("Conversa marcada como não lida");
            }}
            onReply={(message) => setReplyTo(quoteOf(message))}
            onCancelReply={() => setReplyTo(null)}
            onDraft={(text) => setDrafts((list) => ({ ...list, [current.id]: text }))}
            onSend={send}
            onRetry={retry}
            onOpenTemplates={() => setTemplatesOpen(true)}
          />
        ) : (
          <div className={styles.threadEmpty}>
            <EmptyState icon={ChatsCircleIcon} size="sm" title="Selecione uma conversa" description="As mensagens do WhatsApp da equipe aparecem aqui. Escolha uma conversa na lista ou comece uma nova.">
              <Button size="sm" radius="md" variant="secondary" iconStart={<NotePencilIcon />} onClick={() => setNewOpen(true)}>
                Nova conversa
              </Button>
            </EmptyState>
          </div>
        )}
      </section>

      {current && panelOpen && (
        <div className={styles.panel}>
          <ContactPanel
            key={current.id}
            conversation={current}
            team={team}
            stages={stages}
            now={now}
            onClose={() => {
              panelChosen.current = true;
              setPanelOpen(false);
            }}
            onContactChange={(change, notice) => {
              patch(current.id, (conversation) => ({ ...conversation, contact: { ...conversation.contact, ...change } }));
              if (notice) notify(notice);
            }}
          />
        </div>
      )}

      <TemplateDialog
        open={templatesOpen}
        templates={templates}
        contactName={current?.contact.name ?? ""}
        me={meName}
        onClose={() => setTemplatesOpen(false)}
        onSend={(template, values) => {
          if (current) sendTemplate(current.id, template, values);
          setTemplatesOpen(false);
        }}
      />

      <NewConversationDialog
        open={newOpen}
        templates={templates}
        conversations={conversations}
        me={meName}
        onClose={() => setNewOpen(false)}
        onStart={startConversation}
        onOpenExisting={(id) => {
          setNewOpen(false);
          setTab("todas");
          setQuery("");
          select(id);
          toast({ title: "Essa conversa já existe", description: "Abrimos a conversa com esse número.", tone: "info", feedback: false });
        }}
      />
    </div>
  );
}
