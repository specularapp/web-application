"use server";

import { headers } from "next/headers";
import { firstIssue, guardAction, revalidateDomain } from "@/features/organizations/context";
import { cacheTags } from "@/lib/cache/tags";
import { getIssuer } from "@/features/organizations/service";
import { siteConfig } from "@/lib/metadata";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { sendChargeEmail, sendPaymentReportedEmail } from "./emails";
import {
  chargeIdSchema,
  createChargeSchema,
  createTransactionSchema,
  installmentRefSchema,
  payInstallmentSchema,
  reportPaymentSchema, stopRecurrenceSchema } from "./schemas";
import { chargePath, chargeUrl } from "./share";
import {
  cancelCharge,
  createCharge,
  createTransaction,
  getCharge,
  payInstallment,
  reopenInstallment,
  reportPayment,
  sendCharge, stopRecurrence } from "./service";
import type { Charge, Transaction } from "./summary";

/**
 * As actions do financeiro: cada uma valida a entrada com zod, mesmo já validada na tela, e chama a regra de
 * `service.ts`, que é a mesma que o Route Handler de `api/v1` usa. A RLS decide o acesso; o link público
 * entra pela chave secreta, com o token como única credencial.
 */
export type ActionError = { ok: false; error: string; field?: string };

export async function loadChargeAction(id: string): Promise<Charge | null> {
  const guard = await guardAction("charge-load");
  if (!guard.ok) return null;

  return getCharge(guard.context.supabase, guard.context.organizationId, id);
}

export async function createChargeAction(input: unknown): Promise<{ ok: true; charge: Charge } | ActionError> {
  const guard = await guardAction("charge-create");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = createChargeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { supabase, organizationId, user } = guard.context;
  const created = await createCharge(supabase, organizationId, user.id, parsed.data);
  if (!created.ok) return { ok: false, error: created.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.finance], ["/cobrancas", "/financeiro"]);
  return { ok: true, charge: created.charge };
}

export type SendChargeActionResult = { ok: true; charge: Charge; emailed: boolean; reminder: boolean } | ActionError;

/** Envia, ou reenvia, a cobrança por e-mail com o link do cliente. O registro fica mesmo se o e-mail não sair. */
export async function sendChargeAction(input: unknown): Promise<SendChargeActionResult> {
  const guard = await guardAction("charge-send");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = chargeIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { supabase, organizationId, user } = guard.context;
  const result = await sendCharge(supabase, organizationId, parsed.data.id, user.fullName ?? user.email ?? "Equipe");
  if (!result.ok) return result;

  const issuer = await getIssuer(supabase, organizationId);
  const emailed = await sendChargeEmail({
    charge: result.charge,
    url: chargeUrl(result.charge.token),
    issuerName: issuer.name,
    reminder: result.reminder,
  });

  await revalidateDomain(guard.context.organizationId, [cacheTags.finance], ["/cobrancas"]);
  return { ok: true, charge: result.charge, emailed, reminder: result.reminder };
}

export async function payInstallmentAction(input: unknown): Promise<{ ok: true; charge: Charge } | ActionError> {
  const guard = await guardAction("charge-pay");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = payInstallmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { supabase, organizationId, user } = guard.context;
  const result = await payInstallment(supabase, organizationId, user.id, parsed.data);
  if (!result.ok) return result;

  await revalidateDomain(guard.context.organizationId, [cacheTags.finance], ["/cobrancas", "/financeiro"]);
  return { ok: true, charge: result.charge };
}

export async function reopenInstallmentAction(input: unknown): Promise<{ ok: true; charge: Charge } | ActionError> {
  const guard = await guardAction("charge-reopen");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = installmentRefSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await reopenInstallment(
    guard.context.supabase,
    guard.context.organizationId,
    parsed.data.id,
    parsed.data.installmentId,
  );
  if (!result.ok) return result;

  await revalidateDomain(guard.context.organizationId, [cacheTags.finance], ["/cobrancas", "/financeiro"]);
  return { ok: true, charge: result.charge };
}

/** Encerra a série recorrente: esta cobrança fica, a próxima não nasce. */
export async function stopRecurrenceAction(input: unknown): Promise<{ ok: true; charge: Charge } | ActionError> {
  const guard = await guardAction("charge-recurrence-stop");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = stopRecurrenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const stopped = await stopRecurrence(guard.context.supabase, guard.context.organizationId, parsed.data.id);
  if (!stopped.ok) return stopped;

  await revalidateDomain(guard.context.organizationId, [cacheTags.finance], ["/cobrancas", "/financeiro"]);
  return { ok: true, charge: stopped.charge };
}

export async function cancelChargeAction(input: unknown): Promise<{ ok: true; charge: Charge } | ActionError> {
  const guard = await guardAction("charge-cancel");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = chargeIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { supabase, organizationId, user } = guard.context;
  const cancelled = await cancelCharge(supabase, organizationId, parsed.data.id, user.fullName ?? user.email ?? "Equipe");
  if (!cancelled.ok) return cancelled;

  await revalidateDomain(guard.context.organizationId, [cacheTags.finance], ["/cobrancas", "/financeiro"]);
  return { ok: true, charge: cancelled.charge };
}

/** Do link público: o cliente avisa que pagou, e a equipe recebe o aviso por e-mail. */
export async function reportPaymentAction(input: unknown): Promise<{ ok: true; charge: Charge; emailed: boolean } | ActionError> {
  const parsed = reportPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const ip = clientIp(await headers());
  const { allowed } = await checkRateLimit("publicLink", `charge-report:${ip}`, crypto.randomUUID());
  if (!allowed) return { ok: false, error: "Muitas tentativas. Aguarde um instante." };

  const result = await reportPayment(createAdminClient(), parsed.data.token, parsed.data.installmentId);
  if (!result.ok) return result;

  const emailed = result.teamEmail
    ? await sendPaymentReportedEmail({
        to: result.teamEmail,
        charge: result.charge,
        installment: result.installment,
        appUrl: `${siteConfig.url}${chargePath(result.charge.id)}`,
      })
    : false;

  await revalidateDomain(result.organizationId, [cacheTags.finance], ["/cobrancas"]);
  return { ok: true, charge: result.charge, emailed };
}

export async function createTransactionAction(input: unknown): Promise<{ ok: true; transaction: Transaction } | ActionError> {
  const guard = await guardAction("transaction-create");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = createTransactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { supabase, organizationId, user } = guard.context;
  const created = await createTransaction(supabase, organizationId, user.id, parsed.data);
  if (!created.ok) return { ok: false, error: created.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.finance], ["/financeiro"]);
  return { ok: true, transaction: created.data };
}
