"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { firstIssue, guardAction, revalidateDomain } from "@/features/organizations/context";
import { cacheTags } from "@/lib/cache/tags";
import { clientIp, checkRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { attachApprovalAssetSchema, createApprovalSchema, createApprovalVersionSchema, prepareApprovalAssetSchema, publishApprovalVersionSchema, submitApprovalDecisionSchema } from "./schemas";
import { attachApprovalAsset, createApproval, createApprovalVersion, prepareApprovalAsset, publishApprovalVersion, submitPublicApprovalDecision } from "./service";

export async function createApprovalAction(input: unknown) {
  const guard = await guardAction("approval-create");
  if (!guard.ok) return { ok: false as const, error: guard.error };
  const parsed = createApprovalSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, ...firstIssue(parsed.error) };
  const result = await createApproval(guard.context.supabase, guard.context.organizationId, guard.context.user.id, parsed.data);
  if (!result.ok) return { ok: false as const, error: result.error };
  await revalidateDomain(guard.context.organizationId, [cacheTags.approvals], ["/aprovacoes"]);
  return { ok: true as const, ...result.data };
}

export async function createApprovalVersionAction(input: unknown) {
  const guard = await guardAction("approval-version-create");
  if (!guard.ok) return { ok: false as const, error: guard.error };
  const parsed = createApprovalVersionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, ...firstIssue(parsed.error) };
  const result = await createApprovalVersion(guard.context.supabase, guard.context.organizationId, guard.context.user.id, parsed.data);
  if (!result.ok) return { ok: false as const, error: result.error };
  await revalidateDomain(guard.context.organizationId, [cacheTags.approvals], ["/aprovacoes", `/aprovacoes/${parsed.data.approvalId}`]);
  return { ok: true as const, ...result.data };
}

export async function prepareApprovalAssetAction(input: unknown) {
  const guard = await guardAction("approval-asset-prepare");
  if (!guard.ok) return { ok: false as const, error: guard.error };
  const parsed = prepareApprovalAssetSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, ...firstIssue(parsed.error) };
  return prepareApprovalAsset(guard.context.supabase, guard.context.organizationId, parsed.data.versionId, parsed.data.contentType);
}

export async function attachApprovalAssetAction(input: unknown) {
  const guard = await guardAction("approval-asset-attach");
  if (!guard.ok) return { ok: false as const, error: guard.error };
  const parsed = attachApprovalAssetSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, ...firstIssue(parsed.error) };
  const result = await attachApprovalAsset(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!result.ok) return result;
  await revalidateDomain(guard.context.organizationId, [cacheTags.approvals], ["/aprovacoes"]);
  return result;
}

export async function publishApprovalVersionAction(input: unknown) {
  const guard = await guardAction("approval-version-publish");
  if (!guard.ok) return { ok: false as const, error: guard.error };
  const parsed = publishApprovalVersionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, ...firstIssue(parsed.error) };
  const result = await publishApprovalVersion(guard.context.supabase, guard.context.organizationId, guard.context.user.id, parsed.data.versionId);
  if (!result.ok) return result;
  await revalidateDomain(guard.context.organizationId, [cacheTags.approvals], ["/aprovacoes"]);
  return result;
}

export async function submitPublicApprovalAction(token: string, input: unknown) {
  const parsed = submitApprovalDecisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, ...firstIssue(parsed.error) };
  const ip = clientIp(await headers());
  const limit = await checkRateLimit("publicForm", `approval:${token.slice(0, 12)}:${ip}`, crypto.randomUUID());
  if (!limit.allowed) return { ok: false as const, error: "Muitas tentativas. Aguarde alguns minutos." };
  const result = await submitPublicApprovalDecision(createAdminClient(), token, parsed.data);
  if (!result.ok) return { ok: false as const, error: result.error };
  revalidatePath("/aprovacoes");
  return { ok: true as const, id: result.data };
}
