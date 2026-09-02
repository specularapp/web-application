"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  confirmPaymentMethodSchema,
  confirmSubscriptionSchema,
  organizationScopeSchema,
  startSubscriptionSchema,
} from "./schemas";
import {
  cancelSubscription,
  confirmPaymentMethod,
  confirmSubscription,
  resumeSubscription,
  startPaymentMethodUpdate,
  startSubscription,
  type BillingState,
  type CheckoutIntent,
  type ServiceResult,
} from "./service";

const PLAN_PATH = "/configuracoes/plano";
const DASHBOARD_PATH = "/dashboard";
const TOO_MANY = "Muitas ações em pouco tempo. Aguarde um instante e tente de novo.";
const INVALID = "Confira os dados informados.";

async function withinBillingLimit(operation: string, userId: string) {
  const { allowed } = await checkRateLimit("billing", `${operation}:${userId}`, crypto.randomUUID());
  return allowed;
}

function refresh() {
  revalidatePath(PLAN_PATH);
  revalidatePath(DASHBOARD_PATH);
}

export async function startSubscriptionAction(input: unknown): Promise<ServiceResult<CheckoutIntent>> {
  const user = await requireUser(PLAN_PATH);
  if (!(await withinBillingLimit("start", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = startSubscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  // Sem conferir a organização "atual" do perfil: quem manda é `can_manage_billing` no banco, que já
  // exige owner ou admin do time pedido, e a RLS esconde time de que a pessoa não faz parte.
  const supabase = await createClient();
  const result = await startSubscription(supabase, parsed.data, { email: user.email });

  if (result.ok) refresh();
  return result;
}

export async function confirmSubscriptionAction(input: unknown): Promise<ServiceResult<BillingState>> {
  const user = await requireUser(PLAN_PATH);
  if (!(await withinBillingLimit("confirm", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = confirmSubscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const result = await confirmSubscription(supabase, parsed.data);
  if (result.ok) refresh();
  return result;
}

export async function cancelSubscriptionAction(input: unknown): Promise<ServiceResult<BillingState>> {
  const user = await requireUser(PLAN_PATH);
  if (!(await withinBillingLimit("cancel", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = organizationScopeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const result = await cancelSubscription(supabase, parsed.data.organizationId);
  if (result.ok) refresh();
  return result;
}

export async function resumeSubscriptionAction(input: unknown): Promise<ServiceResult<BillingState>> {
  const user = await requireUser(PLAN_PATH);
  if (!(await withinBillingLimit("resume", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = organizationScopeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const result = await resumeSubscription(supabase, parsed.data.organizationId);
  if (result.ok) refresh();
  return result;
}

export async function startPaymentMethodUpdateAction(
  input: unknown,
): Promise<ServiceResult<{ clientSecret: string; setupIntentId: string }>> {
  const user = await requireUser(PLAN_PATH);
  if (!(await withinBillingLimit("card", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = organizationScopeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  return startPaymentMethodUpdate(supabase, parsed.data.organizationId);
}

export async function confirmPaymentMethodAction(input: unknown): Promise<ServiceResult<BillingState>> {
  const user = await requireUser(PLAN_PATH);
  if (!(await withinBillingLimit("card-confirm", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = confirmPaymentMethodSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const result = await confirmPaymentMethod(supabase, parsed.data);
  if (result.ok) refresh();
  return result;
}
