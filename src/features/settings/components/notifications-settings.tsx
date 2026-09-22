"use client";

import { callAction } from "@/lib/action";

import { BellIcon, BellSlashIcon, ChecksIcon, GearSixIcon, WarningCircleIcon, type Icon } from "@phosphor-icons/react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useState, type CSSProperties } from "react";
import { useToast } from "@/components/providers/toast-provider";
import type { AppNotification, NotificationKind } from "@/components/layout/notifications";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TextLink } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { markNotificationsReadBatchAction } from "../actions";
import type { AiUsage } from "@/features/ai/summary";
import { SettingsPage, SettingsSection } from "./settings-page";
import styles from "./settings.module.css";

const kinds: Record<NotificationKind, { label: string; icon: Icon; hue: string }> = {
  acao: { label: "Ação", icon: WarningCircleIcon, hue: "var(--sys-orange)" },
  revisao: { label: "Revisão", icon: ChecksIcon, hue: "var(--sys-blue)" },
  sistema: { label: "Sistema", icon: GearSixIcon, hue: "var(--sys-gray)" },
};

type Filter = "all" | "unread";

/**
 * Todas as notificações (2026-09-17): o sino do menu mostra as recentes, e esta página é a lista inteira,
 * com o filtro de não lidas e o marcar tudo. Clicar numa linha marca como lida; a que tem atalho leva para
 * onde a coisa aconteceu.
 */
export function NotificationsSettings({ items: initial, ai }: { items: AppNotification[]; ai: AiUsage }) {
  const { toast } = useToast();
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [marking, setMarking] = useState(false);

  const unread = items.filter((item) => !item.read);
  const shown = filter === "unread" ? unread : items;

  const markRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    const previous = items;
    setItems((current) => current.map((item) => (ids.includes(item.id) ? { ...item, read: true } : item)));
    const result = await callAction(markNotificationsReadBatchAction(ids));
    if (!result.ok) {
      setItems(previous);
      toast({ title: "Não deu para marcar", description: result.error, tone: "danger" });
      return;
    }
  };

  const markAll = async () => {
    setMarking(true);
    await markRead(unread.map((item) => item.id));
    setMarking(false);
  };

  return (
    <SettingsPage ai={ai}
      aside={
        unread.length > 0 ? (
          <Button size="sm" radius="md" variant="outline" iconStart={<ChecksIcon />} loading={marking} onClick={() => void markAll()}>
            Marcar todas como lidas
          </Button>
        ) : undefined
      }
    >
      <SettingsSection
        title={filter === "unread" ? "Não lidas" : "Todas"}
        aside={
          <div className={styles.rowLine} role="tablist" aria-label="Filtro">
            <Button size="sm" radius="md" variant={filter === "all" ? "secondary" : "ghost"} role="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")}>
              Todas ({items.length})
            </Button>
            <Button size="sm" radius="md" variant={filter === "unread" ? "secondary" : "ghost"} role="tab" aria-selected={filter === "unread"} onClick={() => setFilter("unread")}>
              Não lidas ({unread.length})
            </Button>
          </div>
        }
      >
        {shown.length === 0 ? (
          <EmptyState
            icon={filter === "unread" ? BellSlashIcon : BellIcon}
            size="sm"
            title={filter === "unread" ? "Nada por ler" : "Nenhuma notificação ainda"}
            description={filter === "unread" ? "Tudo o que chegou já foi visto." : "Quando alguém mexer no que é seu, ou o sistema tiver algo a dizer, aparece aqui."}
          />
        ) : (
          <div className={styles.list}>
            {shown.map((item) => {
              const kind = kinds[item.kind];
              return (
                <div key={item.id} className={styles.row} data-unread={!item.read || undefined}>
                  {item.actor ? (
                    <Avatar name={item.actor.name} src={item.actor.avatarUrl ?? undefined} size="md" />
                  ) : (
                    <span className={styles.glyph} style={{ "--item-hue": kind.hue } as CSSProperties} aria-hidden="true">
                      <kind.icon weight="duotone" />
                    </span>
                  )}
                  <div className={styles.rowCopy}>
                    <div className={styles.rowLine}>
                      <Text as="span" variant="subheadline" weight={item.read ? "regular" : "semibold"} truncate>
                        {item.title}
                      </Text>
                      <Badge tone="neutral" variant="soft" size="sm">
                        {kind.label}
                      </Badge>
                      <Text as="span" variant="caption1" tone="secondary">
                        há {formatDistanceToNowStrict(parseISO(item.at), { locale: ptBR })}
                      </Text>
                    </div>
                    {item.description && (
                      <Text as="span" variant="footnote" tone="secondary">
                        {item.description}
                      </Text>
                    )}
                    {item.action && (
                      <TextLink href={item.action.href} onClick={() => void markRead([item.id])}>
                        {item.action.label}
                      </TextLink>
                    )}
                  </div>
                  {!item.read && (
                    <span className={styles.rowEnd}>
                      <Button variant="ghost" size="sm" radius="md" onClick={() => void markRead([item.id])}>
                        Lida
                      </Button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SettingsSection>
    </SettingsPage>
  );
}
