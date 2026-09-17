"use server";

import { firstIssue, guardAction, revalidateDomain } from "@/features/organizations/context";
import { cacheTags } from "@/lib/cache/tags";
import { opportunityFormSchema, opportunityIdSchema, opportunityMoveSchema } from "./schemas";
import { deleteOpportunity, duplicateOpportunity, getOpportunity, moveOpportunity, saveOpportunity } from "./service";
import type { Opportunity } from "./summary";

export type OpportunitySaveResult = { ok: true; id: string } | { ok: false; error: string; field?: string };
export type OpportunityResult = { ok: true } | { ok: false; error: string };

/** A ficha de uma oportunidade, buscada quando a janela abre. */
export async function loadOpportunityAction(id: string): Promise<Opportunity | null> {
  const guard = await guardAction("crm-load");
  if (!guard.ok) return null;

  return getOpportunity(guard.context.supabase, guard.context.organizationId, id);
}

/** Salva a oportunidade, criando ou editando: é o mesmo formulário e a mesma regra. */
export async function saveOpportunityAction(input: unknown): Promise<OpportunitySaveResult> {
  const guard = await guardAction("crm-save");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = opportunityFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const saved = await saveOpportunity(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!saved.ok) return { ok: false, error: saved.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.crm], ["/crm"]);
  return { ok: true, id: saved.data.id };
}

/**
 * Arrastar o cartão de coluna. A etapa precisa ser uma das que o funil declara, e quem recusa isso é o
 * gatilho do banco: sem ele, um pedido forjado mandaria o cartão para uma coluna que o quadro nem desenha.
 */
export async function moveOpportunityAction(input: unknown): Promise<OpportunityResult> {
  const guard = await guardAction("crm-move");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = opportunityMoveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Etapa inválida." };

  const moved = await moveOpportunity(
    guard.context.supabase,
    guard.context.organizationId,
    parsed.data.id,
    parsed.data.stage,
  );
  if (!moved.ok) return { ok: false, error: moved.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.crm], ["/crm"]);
  return { ok: true };
}

export async function deleteOpportunityAction(input: unknown): Promise<OpportunityResult> {
  const guard = await guardAction("crm-delete");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = opportunityIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Oportunidade inválida." };

  const removed = await deleteOpportunity(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!removed.ok) return { ok: false, error: removed.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.crm], ["/crm"]);
  return { ok: true };
}

/** Uma cópia da oportunidade, em aberto na primeira etapa do funil. */
export async function duplicateOpportunityAction(input: unknown): Promise<OpportunityResult> {
  const guard = await guardAction("opportunity-duplicate");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = opportunityIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escolha uma oportunidade." };

  const copy = await duplicateOpportunity(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!copy.ok) return { ok: false, error: copy.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.crm], ["/crm"]);
  return { ok: true };
}
