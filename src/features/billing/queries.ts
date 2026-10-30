import "server-only";
import { requireUser } from "@/features/auth/session";
import { listTeamMembers } from "@/features/organizations/service";
import { createClient } from "@/lib/supabase/server";
import {
  getBillingState,
  getPlanCatalogState,
  listInvoices,
  planLimit,
  resolveOrganization,
  type BillingState,
  type Invoice,
} from "./service";

const PLAN_PATH = "/configuracoes/plano";

async function currentScope(next: string) {
  const user = await requireUser(next);
  const supabase = await createClient();
  const organizationId = await resolveOrganization(supabase, user.id);
  return { supabase, organizationId };
}

/**
 * Estado para a etapa de plano do primeiro acesso. O time pode nascer no meio do fluxo, então sem id
 * a resposta é o catálogo com o gratuito em vigor, que é exatamente a situação de quem acabou de entrar.
 */
export async function getOnboardingBilling(organizationId: string | null): Promise<BillingState> {
  const supabase = await createClient();
  return organizationId
    ? getBillingState(supabase, organizationId)
    : getPlanCatalogState(supabase);
}

export async function getCurrentBillingState(next = PLAN_PATH): Promise<BillingState | null> {
  const { supabase, organizationId } = await currentScope(next);
  if (!organizationId) return null;
  return getBillingState(supabase, organizationId);
}

/** Quem está no time e quantas pessoas o plano em vigor deixa, para o cartão do plano (2026-10-29). Nulo é sem teto. */
export type BillingSeats = { members: { name: string; avatarUrl: string | null }[]; limit: number | null };

export async function getCurrentBillingPage(
  next = PLAN_PATH,
): Promise<{ state: BillingState; invoices: Invoice[]; seats: BillingSeats } | null> {
  const { supabase, organizationId } = await currentScope(next);
  if (!organizationId) return null;

  const [state, invoices, members, limit] = await Promise.all([
    getBillingState(supabase, organizationId),
    listInvoices(supabase, organizationId),
    listTeamMembers(supabase, organizationId),
    planLimit(supabase, organizationId, "team_members").catch(() => null),
  ]);

  return { state, invoices, seats: { members: members.map((member) => ({ name: member.name ?? member.email ?? "Pessoa do time", avatarUrl: member.avatarUrl })), limit } };
}
