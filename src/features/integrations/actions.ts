"use server";

import { firstIssue, guardAction, revalidateDomain } from "@/features/organizations/context";
import type { ApiKeyView, ApiRequestView, WebhookDeliveryView, WebhookView } from "./catalog";
import {
  apiKeyEnabledSchema,
  apiKeyInputSchema,
  apiRequestsQuerySchema,
  integrationIdSchema,
  updateApiKeySchema,
  updateWebhookSchema,
  webhookInputSchema,
} from "./schemas";
import {
  createApiKey,
  createWebhook,
  deleteApiKey,
  deleteWebhook,
  listApiRequests,
  listDeliveries,
  redeliverWebhook,
  revokeApiKey,
  rotateApiKey,
  rotateWebhookSecret,
  setApiKeyEnabled,
  setWebhookActive,
  testWebhook,
  updateApiKey,
  updateWebhook,
} from "./service";

/**
 * As cascas da tela para as chaves de API e os webhooks (2026-10-29): sessão, teto de ações, zod e revalidação da
 * página. A regra mora em `service.ts`, a mesma que as rotas de `api/v1/integracoes` usam.
 */

export type ActionError = { ok: false; error: string; field?: string };

const API_PATH = "/configuracoes/integracoes/api";
const WEBHOOKS_PATH = "/configuracoes/integracoes/webhooks";

const revalidate = (organizationId: string, path: string) => revalidateDomain(organizationId, [], [path], false);

export async function createApiKeyAction(input: unknown): Promise<{ ok: true; key: ApiKeyView; secret: string } | ActionError> {
  const guard = await guardAction("api-key-create");
  if (!guard.ok) return guard;
  const parsed = apiKeyInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { supabase, organizationId, user } = guard.context;
  const created = await createApiKey(supabase, organizationId, user.id, parsed.data);
  if (!created.ok) return created;
  await revalidate(organizationId, API_PATH);
  return { ok: true, ...created.data };
}

export async function updateApiKeyAction(input: unknown): Promise<{ ok: true; key: ApiKeyView } | ActionError> {
  const guard = await guardAction("api-key-update");
  if (!guard.ok) return guard;
  const parsed = updateApiKeySchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { id, ...values } = parsed.data;
  const saved = await updateApiKey(guard.context.supabase, guard.context.organizationId, id, values);
  if (!saved.ok) return saved;
  await revalidate(guard.context.organizationId, API_PATH);
  return { ok: true, key: saved.data };
}

export async function setApiKeyEnabledAction(input: unknown): Promise<{ ok: true; key: ApiKeyView } | ActionError> {
  const guard = await guardAction("api-key-toggle");
  if (!guard.ok) return guard;
  const parsed = apiKeyEnabledSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const saved = await setApiKeyEnabled(guard.context.supabase, guard.context.organizationId, parsed.data.id, parsed.data.enabled);
  if (!saved.ok) return saved;
  await revalidate(guard.context.organizationId, API_PATH);
  return { ok: true, key: saved.data };
}

export async function rotateApiKeyAction(input: unknown): Promise<{ ok: true; key: ApiKeyView; secret: string } | ActionError> {
  const guard = await guardAction("api-key-rotate");
  if (!guard.ok) return guard;
  const parsed = integrationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const rotated = await rotateApiKey(guard.context.supabase, guard.context.organizationId, parsed.data.id);
  if (!rotated.ok) return rotated;
  await revalidate(guard.context.organizationId, API_PATH);
  return { ok: true, ...rotated.data };
}

export async function revokeApiKeyAction(input: unknown): Promise<{ ok: true; key: ApiKeyView } | ActionError> {
  const guard = await guardAction("api-key-revoke");
  if (!guard.ok) return guard;
  const parsed = integrationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const revoked = await revokeApiKey(guard.context.supabase, guard.context.organizationId, parsed.data.id);
  if (!revoked.ok) return revoked;
  await revalidate(guard.context.organizationId, API_PATH);
  return { ok: true, key: revoked.data };
}

export async function deleteApiKeyAction(input: unknown): Promise<{ ok: true } | ActionError> {
  const guard = await guardAction("api-key-delete");
  if (!guard.ok) return guard;
  const parsed = integrationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const removed = await deleteApiKey(guard.context.supabase, guard.context.organizationId, parsed.data.id);
  if (!removed.ok) return removed;
  await revalidate(guard.context.organizationId, API_PATH);
  return { ok: true };
}

export async function loadApiRequestsAction(input: unknown): Promise<{ ok: true; requests: ApiRequestView[] } | ActionError> {
  const guard = await guardAction("api-requests-load");
  if (!guard.ok) return guard;
  const parsed = apiRequestsQuerySchema.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };
  return { ok: true, requests: await listApiRequests(guard.context.supabase, guard.context.organizationId, parsed.data.keyId) };
}

export async function createWebhookAction(input: unknown): Promise<{ ok: true; webhook: WebhookView; secret: string } | ActionError> {
  const guard = await guardAction("webhook-create");
  if (!guard.ok) return guard;
  const parsed = webhookInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { supabase, organizationId, user } = guard.context;
  const created = await createWebhook(supabase, organizationId, user.id, parsed.data);
  if (!created.ok) return { ...created, field: "url" };
  await revalidate(organizationId, WEBHOOKS_PATH);
  return { ok: true, ...created.data };
}

export async function updateWebhookAction(input: unknown): Promise<{ ok: true; webhook: WebhookView } | ActionError> {
  const guard = await guardAction("webhook-update");
  if (!guard.ok) return guard;
  const parsed = updateWebhookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { id, ...values } = parsed.data;
  const saved = await updateWebhook(guard.context.supabase, guard.context.organizationId, id, values);
  if (!saved.ok) return { ...saved, field: "url" };
  await revalidate(guard.context.organizationId, WEBHOOKS_PATH);
  return { ok: true, webhook: saved.data };
}

export async function setWebhookActiveAction(input: unknown): Promise<{ ok: true; webhook: WebhookView } | ActionError> {
  const guard = await guardAction("webhook-toggle");
  if (!guard.ok) return guard;
  const parsed = apiKeyEnabledSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const saved = await setWebhookActive(guard.context.supabase, guard.context.organizationId, parsed.data.id, parsed.data.enabled);
  if (!saved.ok) return saved;
  await revalidate(guard.context.organizationId, WEBHOOKS_PATH);
  return { ok: true, webhook: saved.data };
}

export async function rotateWebhookSecretAction(input: unknown): Promise<{ ok: true; webhook: WebhookView; secret: string } | ActionError> {
  const guard = await guardAction("webhook-rotate");
  if (!guard.ok) return guard;
  const parsed = integrationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const rotated = await rotateWebhookSecret(guard.context.supabase, guard.context.organizationId, parsed.data.id);
  if (!rotated.ok) return rotated;
  await revalidate(guard.context.organizationId, WEBHOOKS_PATH);
  return { ok: true, ...rotated.data };
}

export async function deleteWebhookAction(input: unknown): Promise<{ ok: true } | ActionError> {
  const guard = await guardAction("webhook-delete");
  if (!guard.ok) return guard;
  const parsed = integrationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const removed = await deleteWebhook(guard.context.supabase, guard.context.organizationId, parsed.data.id);
  if (!removed.ok) return removed;
  await revalidate(guard.context.organizationId, WEBHOOKS_PATH);
  return { ok: true };
}

export async function testWebhookAction(input: unknown): Promise<{ ok: true; delivery: WebhookDeliveryView } | ActionError> {
  const guard = await guardAction("webhook-test");
  if (!guard.ok) return guard;
  const parsed = integrationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const sent = await testWebhook(guard.context.supabase, guard.context.organizationId, parsed.data.id);
  if (!sent.ok) return sent;
  return { ok: true, delivery: sent.data };
}

export async function redeliverWebhookAction(input: unknown): Promise<{ ok: true; delivery: WebhookDeliveryView } | ActionError> {
  const guard = await guardAction("webhook-redeliver");
  if (!guard.ok) return guard;
  const parsed = integrationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const sent = await redeliverWebhook(guard.context.supabase, guard.context.organizationId, parsed.data.id);
  if (!sent.ok) return sent;
  return { ok: true, delivery: sent.data };
}

export async function loadDeliveriesAction(input: unknown): Promise<{ ok: true; deliveries: WebhookDeliveryView[] } | ActionError> {
  const guard = await guardAction("webhook-deliveries");
  if (!guard.ok) return guard;
  const parsed = integrationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };
  return { ok: true, deliveries: await listDeliveries(guard.context.supabase, guard.context.organizationId, parsed.data.id) };
}
