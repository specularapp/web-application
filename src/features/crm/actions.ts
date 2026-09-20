"use server";

import { firstIssue, guardAction, revalidateDomain } from "@/features/organizations/context";
import { cacheTags } from "@/lib/cache/tags";
import {
  crmFolderIdSchema,
  funnelIdSchema,
  funnelStagesSchema,
  moveFunnelSchema,
  opportunityFormSchema,
  opportunityIdSchema,
  opportunityMoveSchema,
  saveCrmFolderSchema,
  saveFunnelSchema,
} from "./schemas";
import {
  deleteCrmFolder,
  deleteFunnel,
  deleteOpportunity,
  duplicateOpportunity,
  getOpportunity,
  moveFunnel,
  moveOpportunity,
  saveCrmFolder,
  saveFunnel,
  saveOpportunity,
  setFunnelStages,
} from "./service";
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

/* ------------------------------------------------------------------------------------------------------ */
/* Pastas e funis, pelo leque do menu lateral (2026-09-17). Todas derrubam `crm`, que leva a concha junto:  */
/* a árvore da barra lateral sai da mesma base, e sem isso a pasta nova só apareceria com o cache vencido. */
/* ------------------------------------------------------------------------------------------------------ */

export type CrmFolderSaveResult = { ok: true; id: string } | { ok: false; error: string; field?: string };
export type FunnelSaveResult = { ok: true; id: string; slug: string } | { ok: false; error: string; field?: string };

export async function saveCrmFolderAction(input: unknown): Promise<CrmFolderSaveResult> {
  const guard = await guardAction("crm-folder-save");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = saveCrmFolderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const saved = await saveCrmFolder(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!saved.ok) return { ok: false, error: saved.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.crm], ["/crm"]);
  return { ok: true, id: saved.data.id };
}

export async function deleteCrmFolderAction(input: unknown): Promise<OpportunityResult> {
  const guard = await guardAction("crm-folder-delete");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = crmFolderIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escolha a pasta." };

  const removed = await deleteCrmFolder(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!removed.ok) return { ok: false, error: removed.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.crm], ["/crm"]);
  return { ok: true };
}

export async function saveFunnelAction(input: unknown): Promise<FunnelSaveResult> {
  const guard = await guardAction("funnel-save");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = saveFunnelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const saved = await saveFunnel(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!saved.ok) return { ok: false, error: saved.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.crm], ["/crm"]);
  return { ok: true, id: saved.data.id, slug: saved.data.slug };
}

export async function deleteFunnelAction(input: unknown): Promise<OpportunityResult> {
  const guard = await guardAction("funnel-delete");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = funnelIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escolha o funil." };

  const removed = await deleteFunnel(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!removed.ok) return { ok: false, error: removed.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.crm], ["/crm"]);
  return { ok: true };
}

/** As etapas do funil, na ordem das colunas. */
export async function setFunnelStagesAction(input: unknown): Promise<OpportunityResult> {
  const guard = await guardAction("funnel-stages");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = funnelStagesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error).error };

  const saved = await setFunnelStages(guard.context.supabase, guard.context.organizationId, parsed.data.id, parsed.data.stages);
  if (!saved.ok) return { ok: false, error: saved.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.crm], ["/crm"]);
  return { ok: true };
}

/** Move o funil para uma pasta, ou para a raiz quando ela é nula. */
export async function moveFunnelAction(input: unknown): Promise<OpportunityResult> {
  const guard = await guardAction("funnel-move");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = moveFunnelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escolha o funil e a pasta." };

  const moved = await moveFunnel(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!moved.ok) return { ok: false, error: moved.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.crm], ["/crm"]);
  return { ok: true };
}
