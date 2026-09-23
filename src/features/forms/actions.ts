"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { clientIp, checkRateLimit } from "@/lib/security/rate-limit";
import { cacheTags } from "@/lib/cache/tags";
import { firstIssue, guardAction, revalidateDomain } from "@/features/organizations/context";
import { deleteIntakeForm, saveIntakeForm, submitPublicIntakeForm } from "./service";
import { formIdSchema, intakeFormSchema, publicAnswersSchema } from "./schemas";

export async function saveIntakeFormAction(input: unknown) {
  const guard = await guardAction("intake-form-save");
  if (!guard.ok) return { ok: false as const, error: guard.error };
  const parsed = intakeFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, ...firstIssue(parsed.error) };

  const saved = await saveIntakeForm(guard.context.supabase, guard.context.organizationId, guard.context.user.id, parsed.data);
  if (!saved.ok) return { ok: false as const, error: saved.error };
  await revalidateDomain(guard.context.organizationId, [cacheTags.forms], ["/formularios"]);
  return { ok: true as const, ...saved.data };
}

export async function deleteIntakeFormAction(input: unknown) {
  const guard = await guardAction("intake-form-delete");
  if (!guard.ok) return { ok: false as const, error: guard.error };
  const parsed = formIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Formulário inválido." };
  const removed = await deleteIntakeForm(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!removed.ok) return { ok: false as const, error: removed.error };
  await revalidateDomain(guard.context.organizationId, [cacheTags.forms], ["/formularios"]);
  return { ok: true as const };
}

export async function submitPublicIntakeFormAction(token: string, input: unknown) {
  const parsed = publicAnswersSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, ...firstIssue(parsed.error) };
  const ip = clientIp(await headers());
  const limit = await checkRateLimit("publicForm", `intake:${token.slice(0, 12)}:${ip}`, crypto.randomUUID());
  if (!limit.allowed) return { ok: false as const, error: "Muitas tentativas. Aguarde alguns minutos e envie novamente." };

  const result = await submitPublicIntakeForm(createAdminClient(), token, parsed.data);
  if (!result.ok) return { ok: false as const, error: result.error };
  revalidatePath("/formularios");
  return { ok: true as const, submissionId: result.data.submissionId };
}
