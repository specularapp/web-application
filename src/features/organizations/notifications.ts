import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Route } from "next";
import type { AppNotification } from "@/components/layout/notifications";
import type { Database } from "@/types/database";

/**
 * As notificações de quem está na conta, no time em que está. Ficam aqui, e não numa feature própria, pelo
 * mesmo motivo do contexto de organização: é infraestrutura da concha, e não um domínio de negócio.
 *
 * Quem escreve é o servidor, pela função `notify_member` com a chave secreta: notificação criada pela
 * sessão seria notificação que a própria tela pode inventar. A única escrita da pessoa é marcar como lida.
 */
export type NotificationsClient = SupabaseClient<Database>;

/** Quantas a lista carrega: o painel mostra as recentes, e o resto envelhece sem ninguém procurar. */
const LIMIT = 30;

export async function listNotifications(
  client: NotificationsClient,
  organizationId: string,
  userId: string,
): Promise<AppNotification[]> {
  const { data } = await client
    .from("notifications")
    .select("id, kind, title, description, actor_name, actor_avatar_url, action_label, action_href, read_at, created_at")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(LIMIT);

  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    at: row.created_at,
    read: Boolean(row.read_at),
    actor: row.actor_name ? { name: row.actor_name, avatarUrl: row.actor_avatar_url } : undefined,
    action: row.action_label && row.action_href ? { label: row.action_label, href: row.action_href as Route } : undefined,
  }));
}

export async function markNotificationsRead(client: NotificationsClient, userId: string, ids: string[]) {
  if (ids.length === 0) return;
  await client.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).in("id", ids);
}
