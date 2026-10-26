"use client";

import {
  ChatCircleDotsIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  PencilSimpleIcon,
  PushPinIcon,
  PushPinSlashIcon,
  SidebarSimpleIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { NameDialog } from "@/components/ui/name-dialog";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { Tooltip } from "@/components/ui/tooltip";
import { rounded } from "@/lib/corners";
import { aiHistory, type AiConversation } from "../conversation";
import { aiRemaining, aiTone } from "../summary";
import { useAiPanel } from "./ai-panel-context";
import { AiUsageDialog } from "./ai-usage-dialog";
import styles from "./ai-history.module.css";

export type AiHistoryProps = {
  /** Escolher uma conversa ou começar outra; fecha a gaveta, quando o histórico está dentro de uma. */
  onPick?: () => void;
  /** Recolher a coluna no computador, ou fechar a gaveta no celular. */
  onHide: () => void;
  /** O nome do botão que esconde o histórico, que muda entre coluna e gaveta. */
  hideLabel: string;
  /** As conversas fixadas no alto. Valem nesta sessão: o banco ainda não guarda a marca. */
  pinned: readonly string[];
  onTogglePin: (id: string) => void;
};

/**
 * O histórico de conversas do SpeculAI: no alto, começar uma nova e recolher; a busca, que varre o nome e o que
 * foi dito; as conversas em faixas de tempo, com as fixadas primeiro e a aberta marcada; e o uso do ciclo no pé.
 */
export function AiHistory({ onPick, onHide, hideLabel, pinned, onTogglePin }: AiHistoryProps) {
  const panel = useAiPanel();
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState<AiConversation | null>(null);
  const [removing, setRemoving] = useState<AiConversation | null>(null);
  const [usageOpen, setUsageOpen] = useState(false);

  if (!panel) return null;

  const conversations = panel.conversations;
  const fixed = conversations.filter((conversation) => pinned.includes(conversation.id));
  const loose = conversations.filter((conversation) => !pinned.includes(conversation.id));
  const fixedFound = aiHistory(fixed, search).flatMap((group) => group.conversations);
  const groups = [
    ...(fixedFound.length > 0 ? [{ id: "fixadas", label: "Fixadas", conversations: fixedFound }] : []),
    ...aiHistory(loose, search),
  ];
  const usage = panel.data?.usage;

  const menuOf = (conversation: AiConversation): DropdownSection[] => {
    const isPinned = pinned.includes(conversation.id);
    return [
      {
        id: "conversa",
        items: [
          { id: "renomear", label: "Renomear", icon: PencilSimpleIcon, onSelect: () => setRenaming(conversation) },
          {
            id: "fixar",
            label: isPinned ? "Desafixar" : "Fixar no alto",
            icon: isPinned ? PushPinSlashIcon : PushPinIcon,
            onSelect: () => onTogglePin(conversation.id),
          },
        ],
      },
      {
        id: "remover",
        items: [{ id: "excluir", label: "Excluir", icon: TrashIcon, tone: "danger", onSelect: () => setRemoving(conversation) }],
      },
    ];
  };

  return (
    <div className={styles.history}>
      <div className={styles.head}>
        <Button
          variant="secondary"
          size="sm"
          radius="md"
          iconStart={<NotePencilIcon />}
          className={styles.new}
          onClick={() => {
            panel.reset();
            onPick?.();
          }}
        >
          Nova conversa
        </Button>
        <Tooltip content={hideLabel} align="end">
          <IconButton label={hideLabel} variant="ghost" size="sm" radius="md" onClick={onHide}>
            <SidebarSimpleIcon />
          </IconButton>
        </Tooltip>
      </div>

      <Input
        size="sm"
        value={search}
        placeholder="Buscar conversa"
        aria-label="Buscar nas conversas"
        iconStart={<MagnifyingGlassIcon />}
        onChange={(event) => setSearch(event.target.value)}
      />

      <nav className={styles.list} aria-label="Conversas">
        {groups.length === 0 ? (
          <p className={styles.empty}>
            <ChatCircleDotsIcon weight="duotone" aria-hidden="true" />
            <Text as="span" variant="footnote" tone="secondary">
              {search.trim() ? "Nenhuma conversa com esse termo." : "Suas conversas aparecem aqui."}
            </Text>
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.id} className={styles.group}>
              <Text as="h2" variant="caption1" weight="medium" tone="secondary" className={styles.groupName}>
                {group.label}
              </Text>
              <ul className={styles.items}>
                {group.conversations.map((conversation) => {
                  const current = conversation.id === panel.currentId;
                  return (
                    <li key={conversation.id} className={styles.item} data-current={current || undefined} {...rounded("md")}>
                      <button
                        type="button"
                        className={styles.open}
                        aria-current={current ? "page" : undefined}
                        onClick={() => {
                          panel.resume(conversation.id);
                          onPick?.();
                        }}
                      >
                        {pinned.includes(conversation.id) && <PushPinIcon weight="fill" aria-hidden="true" className={styles.pin} />}
                        <Text as="span" variant="footnote" weight={current ? "medium" : "regular"} truncate className={styles.title}>
                          {conversation.title}
                        </Text>
                      </button>
                      <span className={styles.menu}>
                        <DropdownMenu
                          label={"Ações de " + conversation.title}
                          triggerLabel={"Abrir ações de " + conversation.title}
                          sections={menuOf(conversation)}
                          size="sm"
                          searchable={false}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </nav>

      {usage && (
        <footer className={styles.foot}>
          <button type="button" className={styles.usage} onClick={() => setUsageOpen(true)} {...rounded("md")}>
            <span className={styles.usageLine}>
              <Text as="span" variant="caption2" tone="secondary">
                Uso da IA
              </Text>
              <Text as="span" variant="caption2" tone="secondary" numeric>
                {aiRemaining(usage)} restantes
              </Text>
            </span>
            <Progress
              value={usage.used}
              max={usage.limit}
              tone={aiTone(usage)}
              size="xs"
              segments={10}
              aria-label={`${usage.used} de ${usage.limit} ações de IA usadas neste ciclo`}
            />
          </button>
          <AiUsageDialog usage={usage} open={usageOpen} onClose={() => setUsageOpen(false)} />
        </footer>
      )}

      <NameDialog
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title="Renomear conversa"
        label="Nome da conversa"
        initialValue={renaming?.title ?? ""}
        maxLength={80}
        confirmLabel="Salvar"
        onSubmit={(title) => {
          if (renaming) panel.rename(renaming.id, title);
          setRenaming(null);
          return Promise.resolve(undefined);
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        title="Excluir esta conversa?"
        description={removing ? `"${removing.title}" sai do histórico e não tem volta.` : ""}
        confirmLabel="Excluir"
        tone="danger"
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) panel.remove(removing.id);
          setRemoving(null);
        }}
      />
    </div>
  );
}
