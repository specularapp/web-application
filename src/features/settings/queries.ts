import "server-only";
import type { AppNotification } from "@/components/layout/notifications";
import { listTotpFactors } from "@/features/auth/actions";
import { getBillingState, type BillingState } from "@/features/billing/service";
import { requireOrganization } from "@/features/organizations/context";
import { getTeamState, getTeamSummary, type TeamMember, type TeamState } from "@/features/organizations/service";
import type { TeamMember as MemberSummary } from "@/features/organizations/summary";
import { hasAi, hasResend, hasStripe } from "@/lib/env";
import { siteConfig } from "@/lib/metadata";
import { getAccount, getCustomDomain, getResume, type Account, type CustomDomain, type Resume } from "./service";

/**
 * O que cada página de configuração precisa, de uma vez. Sem cache: são fichas da própria pessoa, lidas ao
 * abrir a página e escritas ali mesmo, e o cache só atrasaria a leitura do que acabou de ser salvo.
 */

/**
 * A página da conta (2026-09-20): a conta, o currículo e a pessoa **como o bloco de equipe do painel já a
 * mede** (`getTeamSummary`: papel, pontos e os quatro números), em vez de uma conta nova só para esta
 * página. A equipe saiu daqui: ela tem a própria página.
 */
export type AccountSettings = {
  account: Account;
  resume: Resume | null;
  viewer: TeamMember;
  /** A pessoa no resumo da equipe; nula enquanto ela não estiver na lista de membros. */
  member: MemberSummary | null;
};

export async function getAccountSettings(): Promise<AccountSettings | null> {
  const { supabase, user, organizationId } = await requireOrganization("/configuracoes");
  const [account, resume, state, summary] = await Promise.all([
    getAccount(supabase, user.id),
    getResume(supabase, user.id),
    getTeamState(supabase, user.id),
    getTeamSummary(supabase, organizationId),
  ]);
  if (!account) return null;
  return { account, resume, viewer: state.viewer, member: summary.members.find((member) => member.id === user.id) ?? null };
}

export async function getTeamSettings(): Promise<TeamState> {
  const { supabase, user } = await requireOrganization("/configuracoes/equipe");
  return getTeamState(supabase, user.id);
}

export type Authenticator = { id: string; name: string; verified: boolean; createdAt: string };

export type SecuritySettings = {
  email: string | null;
  /** Como a pessoa entra: por senha, ou só por provedor (Google, GitHub, Apple), em que não há senha para trocar. */
  hasPassword: boolean;
  providers: string[];
  authenticators: Authenticator[];
};

export async function getSecuritySettings(): Promise<SecuritySettings> {
  const { supabase } = await requireOrganization("/configuracoes/seguranca");
  const [{ data }, factors] = await Promise.all([supabase.auth.getUser(), listTotpFactors()]);
  const user = data.user;
  const providers = (user?.app_metadata?.providers as string[] | undefined) ?? [];

  return {
    email: user?.email ?? null,
    hasPassword: providers.includes("email"),
    providers: providers.filter((provider) => provider !== "email"),
    authenticators: factors.map((factor) => ({
      id: factor.id,
      name: factor.friendly_name ?? "Autenticador",
      verified: factor.status === "verified",
      createdAt: factor.created_at,
    })),
  };
}

/** Quantas a página mostra: bem mais que a concha, que só traz as recentes. */
const NOTIFICATIONS_LIMIT = 200;

export async function getNotificationsSettings(): Promise<AppNotification[]> {
  const { supabase, organizationId, user } = await requireOrganization("/configuracoes/notificacoes");

  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, description, actor_name, actor_avatar_url, action_label, action_href, read_at, created_at")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(NOTIFICATIONS_LIMIT);

  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    at: row.created_at,
    read: Boolean(row.read_at),
    actor: row.actor_name ? { name: row.actor_name, avatarUrl: row.actor_avatar_url } : undefined,
    action: row.action_label && row.action_href ? { label: row.action_label, href: row.action_href as AppNotification["action"] extends infer A ? (A extends { href: infer H } ? H : never) : never } : undefined,
  }));
}

export type DomainSettings = { domain: CustomDomain; billing: BillingState | null };

export async function getDomainSettings(): Promise<DomainSettings | null> {
  const { supabase, organizationId } = await requireOrganization("/configuracoes/dominio");
  const [domain, billing] = await Promise.all([getCustomDomain(supabase, organizationId), getBillingState(supabase, organizationId).catch(() => null)]);
  if (!domain) return null;
  return { domain, billing };
}

/** O que está ligado na casa, para a página de integrações dizer a verdade e nada além. */
export type IntegrationsSettings = {
  stripe: { configured: boolean; connected: boolean };
  email: { configured: boolean };
  ai: { configured: boolean };
  webhook: { url: string; header: string };
  api: { baseUrl: string };
};

export async function getIntegrationsSettings(): Promise<IntegrationsSettings> {
  const { supabase, organizationId } = await requireOrganization("/configuracoes/integracoes");
  const billing = await getBillingState(supabase, organizationId).catch(() => null);

  return {
    stripe: { configured: hasStripe(), connected: Boolean(billing?.hasSubscription || billing?.hasPaymentMethod) },
    email: { configured: hasResend() },
    ai: { configured: hasAi() },
    webhook: { url: `${siteConfig.url}/api/webhooks/n8n`, header: "x-webhook-secret" },
    api: { baseUrl: `${siteConfig.url}/api/v1` },
  };
}

export type ResumeSettings = { resume: Resume; publicUrl: string | null };

export async function getResumeSettings(): Promise<ResumeSettings | null> {
  const { supabase, user } = await requireOrganization("/curriculo");
  const resume = await getResume(supabase, user.id);
  if (!resume) return null;
  return { resume, publicUrl: resume.resumeSlug ? `${siteConfig.url}/cv/${resume.resumeSlug}` : null };
}
