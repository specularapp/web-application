"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { firstIssue, guardAction, revalidateDomain } from "@/features/organizations/context";
import { cacheTags } from "@/lib/cache/tags";
import { clientIp, checkRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { createFeedbackSchema, submitFeedbackSchema } from "./schemas";
import { ensureClientFeedback, submitPublicClientFeedback } from "./service";
import { feedbackUrl } from "./share";

export async function createFeedbackAction(input: unknown) {
  const guard = await guardAction("feedback-create");
  if (!guard.ok) return { ok: false as const, error: guard.error };
  const parsed = createFeedbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, ...firstIssue(parsed.error) };
  const result = await ensureClientFeedback(guard.context.supabase, guard.context.organizationId, guard.context.user.id, parsed.data);
  if (!result.ok) return { ok: false as const, error: result.error };
  await revalidateDomain(guard.context.organizationId, [cacheTags.feedbacks], ["/feedbacks", "/projetos"]);
  return { ok: true as const, feedback: result.data.feedback, url: feedbackUrl(result.data.feedback.shareToken) };
}

export async function submitPublicFeedbackAction(token: string, input: unknown) {
  const parsed = submitFeedbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, ...firstIssue(parsed.error) };
  const ip = clientIp(await headers());
  const limit = await checkRateLimit("publicForm", `feedback:${token.slice(0, 12)}:${ip}`, crypto.randomUUID());
  if (!limit.allowed) return { ok: false as const, error: "Muitas tentativas. Aguarde alguns minutos." };
  const result = await submitPublicClientFeedback(createAdminClient(), token, parsed.data);
  if (!result.ok) return { ok: false as const, error: result.error };
  revalidatePath("/feedbacks");
  return { ok: true as const, id: result.data };
}
