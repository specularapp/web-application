import "server-only";
import { cache } from "react";
import { planBadges, type PlanId } from "@/features/billing/plans";
import { getOnboardingBilling } from "@/features/billing/queries";
import { getAiUsage } from "@/features/ai/service";
import type { AiUsage } from "@/features/ai/summary";
import { getCrmOpenCounts, getCrmTree } from "@/features/crm/service";
import { buildCrmTree, type CrmTreeItem } from "@/features/crm/tree";
import { roleLabels } from "@/features/onboarding/labels";
import { getProjectTree } from "@/features/projects/service";
import { getTaskOpenCounts } from "@/features/tasks/service";
import { buildTaskTree, type TaskTreeItem } from "@/features/tasks/tree";
import type { AppNotification } from "@/components/layout/notifications";
import { pickAlert, type SidebarAlert } from "@/components/layout/alerts";
import { cacheKey, cacheTtl, cached } from "@/lib/cache";
import { cacheTags } from "@/lib/cache/tags";
import { getOrganizationContext, type OrganizationContext } from "./context";
import { listNotifications } from "./notifications";
import { getCurrentTeamState, getTeamOptions } from "./queries";
import { getSidebarAlerts } from "./shell";

/** Sem time em vigor não há ciclo para contar. */
const NO_AI_USAGE: AiUsage = { used: 0, limit: 0, renewsAt: new Date().toISOString().slice(0, 10) };

/**
 * Tudo que o menu desenha, numa leitura só e guardada em Redis.
 *
 * O menu é redesenhado em **toda navegação**, e antes disso ele custava quinze idas ao banco, duas delas
 * carregando até quinhentas tarefas e quinhentas oportunidades inteiras só para contar quantas estavam em
 * aberto por projeto e por funil. Agora as contagens vêm agrupadas do banco (`task_open_counts`,
 * `opportunity_open_counts`), o resto sai em paralelo e o conjunto fica guardado por dois minutos, com a
 * chave carregando pessoa e organização. Qualquer escrita de tarefa, projeto, funil, cobrança ou time
 * derruba a tag `shell` e a leitura seguinte vem fresca.
 *
 * O assistente **não entra aqui**: as conversas dele são conteúdo longo e a coluna começa fechada, então
 * elas passaram a ser buscadas quando a pessoa abre o painel.
 */
export type ShellData = {
  team: { name: string; logoUrl: string | null; plan: string };
  user: { name: string; email: string | null; role: string; avatarUrl: string | null };
  teams: { id: string; name: string; logoUrl: string | null; plan: string }[];
  currentTeamId: string | null;
  notifications: AppNotification[];
  alert: SidebarAlert | undefined;
  tasks: TaskTreeItem[];
  funnels: CrmTreeItem[];
  /** Quanto da IA do plano já foi usado no ciclo: o widget do topo mostra em toda página. */
  ai: AiUsage;
  /** O plano que vale agora, que é o que o portão de plano consulta em toda ação bloqueada. */
  effectivePlan: PlanId;
};

async function load(context: OrganizationContext | null): Promise<ShellData> {
  const [state, teams] = await Promise.all([getCurrentTeamState(), getTeamOptions()]);
  const billing = await getOnboardingBilling(state.team?.id ?? null);

  const base = {
    team: {
      name: state.team?.name ?? "Seu time",
      logoUrl: state.team?.logoUrl ?? null,
      plan: planBadges[billing.effectivePlan],
    },
    user: {
      name: state.viewer.name ?? state.viewer.email ?? "Você",
      email: state.viewer.email,
      role: roleLabels[state.viewer.role],
      avatarUrl: state.viewer.avatarUrl,
    },
    teams: teams.map((option) => ({
      id: option.id,
      name: option.name,
      logoUrl: option.logoUrl,
      plan: planBadges[option.plan],
    })),
    currentTeamId: state.team?.id ?? null,
    effectivePlan: billing.effectivePlan,
  };

  /* Sem time em vigor a concha abre vazia em vez de mandar a pessoa embora: quem decide o que fazer nesse
     caso é o painel, que mostra a configuração inicial por cima. */
  if (!context) return { ...base, notifications: [], alert: undefined, tasks: [], funnels: [], ai: NO_AI_USAGE };

  const { supabase, organizationId, user } = context;
  const [notifications, alerts, taskTree, taskCounts, crmTree, crmCounts, ai] = await Promise.all([
    listNotifications(supabase, organizationId, user.id),
    getSidebarAlerts(supabase, organizationId),
    getProjectTree(supabase, organizationId),
    getTaskOpenCounts(supabase, organizationId),
    getCrmTree(supabase, organizationId),
    getCrmOpenCounts(supabase, organizationId),
    getAiUsage(supabase, organizationId),
  ]);
  const alert = pickAlert(alerts);

  return {
    ...base,
    notifications,
    alert: alert ? { ...alert, remaining: Math.max(0, alerts.length - 1) } : undefined,
    tasks: buildTaskTree(taskTree, taskCounts),
    funnels: buildCrmTree(crmTree, crmCounts),
    ai,
  };
}

/* Memorizado por requisição também: o layout desenha o menu e a página pede o uso da IA da mesma leitura. */
export const getShellData = cache(async function getShellData(): Promise<ShellData> {
  const context = await getOrganizationContext();
  if (!context) return load(null);

  return cached(
    cacheKey(context.organizationId, "shell", context.user.id),
    { organizationId: context.organizationId, tags: [cacheTags.shell], ttl: cacheTtl.shell },
    () => load(context),
  );
});
