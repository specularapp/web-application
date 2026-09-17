import "server-only";
import { addDays, format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Route } from "next";
import type { SidebarAlert } from "@/components/layout/alerts";
import { describeAlert } from "@/components/layout/alerts";
import type { Database } from "@/types/database";

/**
 * O aviso do cartão do menu, tirado do que a conta de fato tem: a entrega mais próxima, a cobrança que
 * vence antes e a tarefa no prazo. É derivado, e não uma tabela: o que ele anuncia já está em projetos,
 * cobranças e tarefas, e guardar uma cópia faria o cartão anunciar o que já foi resolvido.
 */
export type ShellClient = SupabaseClient<Database>;

/** Até onde o cartão olha para a frente: passar disso é agenda, e não aviso. */
const HORIZON_DAYS = 14;

export async function getSidebarAlerts(client: ShellClient, organizationId: string): Promise<SidebarAlert[]> {
  const today = new Date();
  const limit = format(addDays(today, HORIZON_DAYS), "yyyy-MM-dd");

  const [projects, installments, tasks] = await Promise.all([
    client
      .from("projects")
      .select("id, name, due_at, clients(name, avatar_url)")
      .eq("organization_id", organizationId)
      .in("status", ["active", "paused"])
      .not("due_at", "is", null)
      .lte("due_at", limit)
      .order("due_at")
      .limit(3),
    client
      .from("charge_installments")
      .select("id, due_date, amount, charges!inner(id, title, client_name, client_avatar_url, cancelled_at)")
      .eq("organization_id", organizationId)
      .is("paid_at", null)
      .lte("due_date", limit)
      .order("due_date")
      .limit(3),
    client
      .from("tasks")
      .select("id, title, due_date, projects(name)")
      .eq("organization_id", organizationId)
      .neq("stage", "done")
      .lte("due_date", limit)
      .order("due_date")
      .limit(3),
  ]);

  const alerts: SidebarAlert[] = [];

  for (const project of projects.data ?? []) {
    if (!project.due_at) continue;
    const startsAt = new Date(`${project.due_at}T12:00:00`);
    alerts.push({
      id: `delivery-${project.id}`,
      kind: "delivery",
      title: `Entrega de ${project.name}`,
      detail: describeAlert("delivery", { startsAt }, today),
      startsAt: startsAt.toISOString(),
      people: project.clients ? [{ name: project.clients.name, avatarUrl: project.clients.avatar_url }] : [],
      action: { label: "Abrir projeto", href: `/projetos/${project.id}` as Route },
    });
  }

  for (const installment of installments.data ?? []) {
    if (installment.charges.cancelled_at) continue;
    const startsAt = new Date(`${installment.due_date}T12:00:00`);
    alerts.push({
      id: `invoice-${installment.id}`,
      kind: "invoice",
      title: installment.charges.title,
      detail: describeAlert("invoice", { startsAt }, today),
      startsAt: startsAt.toISOString(),
      people: [{ name: installment.charges.client_name, avatarUrl: installment.charges.client_avatar_url }],
      action: { label: "Ver cobrança", href: `/cobrancas/${installment.charges.id}` as Route },
    });
  }

  for (const task of tasks.data ?? []) {
    const startsAt = new Date(`${task.due_date}T12:00:00`);
    alerts.push({
      id: `task-${task.id}`,
      kind: "task",
      title: task.title,
      detail: describeAlert("task", { startsAt }, today),
      startsAt: startsAt.toISOString(),
      people: [],
      action: { label: "Abrir tarefa", href: "/tarefas" },
    });
  }

  return alerts;
}
