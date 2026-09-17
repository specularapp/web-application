"use server";

import { firstIssue, guardAction, revalidateDomain } from "@/features/organizations/context";
import { cacheTags } from "@/lib/cache/tags";
import { automationIdSchema, automationStatusSchema, createAutomationSchema, saveAutomationSchema } from "./schemas";
import {
  createAutomation,
  deleteAutomation,
  duplicateAutomation,
  getAutomation,
  saveAutomation,
  setAutomationStatus,
  testAutomation,
} from "./service";
import type { Automation, AutomationRun } from "./summary";

/**
 * As actions das automações: cada uma valida a entrada com zod, mesmo já validada na tela, e chama a regra
 * de `service.ts`, que é a mesma que o Route Handler de `api/v1` usa. A RLS decide o acesso.
 */
export type ActionError = { ok: false; error: string; field?: string };

export async function loadAutomationAction(id: string): Promise<Automation | null> {
  const guard = await guardAction("automation-load");
  if (!guard.ok) return null;

  return getAutomation(guard.context.supabase, guard.context.organizationId, id);
}

export async function createAutomationAction(input: unknown): Promise<{ ok: true; id: string } | ActionError> {
  const guard = await guardAction("automation-create");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = createAutomationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { supabase, organizationId, user } = guard.context;
  const created = await createAutomation(supabase, organizationId, user.id, parsed.data);
  if (!created.ok) return { ok: false, error: created.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.automations], ["/automacoes"]);
  return { ok: true, id: created.data.id };
}

export async function saveAutomationAction(input: unknown): Promise<{ ok: true; automation: Automation } | ActionError> {
  const guard = await guardAction("automation-save");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = saveAutomationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const saved = await saveAutomation(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!saved.ok) return { ok: false, error: saved.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.automations], ["/automacoes"]);
  return { ok: true, automation: saved.automation };
}

export async function setAutomationStatusAction(input: unknown): Promise<{ ok: true; automation: Automation } | ActionError> {
  const guard = await guardAction("automation-status");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = automationStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const saved = await setAutomationStatus(
    guard.context.supabase,
    guard.context.organizationId,
    parsed.data.id,
    parsed.data.status,
  );
  if (!saved.ok) return { ok: false, error: saved.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.automations], ["/automacoes"]);
  return { ok: true, automation: saved.automation };
}

export async function duplicateAutomationAction(input: unknown): Promise<{ ok: true; id: string } | ActionError> {
  const guard = await guardAction("automation-duplicate");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = automationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { supabase, organizationId, user } = guard.context;
  const copy = await duplicateAutomation(supabase, organizationId, user.id, parsed.data.id);
  if (!copy.ok) return { ok: false, error: copy.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.automations], ["/automacoes"]);
  return { ok: true, id: copy.data.id };
}

export async function deleteAutomationAction(input: unknown): Promise<{ ok: true } | ActionError> {
  const guard = await guardAction("automation-delete");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = automationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const removed = await deleteAutomation(guard.context.supabase, guard.context.organizationId, parsed.data.id);
  if (!removed.ok) return { ok: false, error: removed.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.automations], ["/automacoes"]);
  return { ok: true };
}

export async function testAutomationAction(input: unknown): Promise<{ ok: true; automation: Automation; run: AutomationRun } | ActionError> {
  const guard = await guardAction("automation-test");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = automationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { supabase, organizationId, user } = guard.context;
  const result = await testAutomation(supabase, organizationId, user.id, parsed.data.id);
  if (!result.ok) return { ok: false, error: result.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.automations], ["/automacoes"]);
  return { ok: true, automation: result.automation, run: result.run };
}
