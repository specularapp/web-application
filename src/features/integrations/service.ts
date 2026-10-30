import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { dbMessage } from "@/lib/db/message";
import { siteConfig } from "@/lib/metadata";
import { createAdminClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import {
  MAX_API_KEYS,
  MAX_WEBHOOKS,
  type ApiKeyView,
  type ApiRequestView,
  type ApiScope,
  type DeliveryStatus,
  type WebhookDeliveryView,
  type WebhookEvent,
  type WebhookView,
} from "./catalog";
import { postJson, publicUrlProblem } from "./net";
import type { ApiKeyInput, WebhookInput } from "./schemas";
import { newApiKey, signWebhook, webhookSecret } from "./secrets";

/**
 * Chaves de API e webhooks de saída (2026-10-29, a pedido: "integração deixe completo tudo igual temos na Le Ange").
 *
 * Como todo serviço da casa, recebe o cliente Supabase de fora e não sabe quem chamou: a action da tela e a rota da
 * `api/v1` são cascas finas sobre isto. Quem escreve é decidido pela RLS (dono ou administrador, com MFA); o
 * `organization_id` aqui é filtro e preenchimento. O disparo dos eventos roda com a chave secreta, porque o evento
 * pode nascer de uma página pública sem sessão, como o cliente aprovando o orçamento pelo link.
 */

export type IntegrationsClient = SupabaseClient<Database>;
export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

const SAVE_FAILED = "Não foi possível salvar. Tente de novo em instantes.";
const FORBIDDEN = "Só o dono e os administradores do time mexem nas integrações, com a verificação em duas etapas em dia.";
const DELIVERIES_SHOWN = 100;
const REQUESTS_SHOWN = 200;

const fail = (error: string) => ({ ok: false as const, error });
const done = <T>(data: T) => ({ ok: true as const, data });
const failure = (error: { code?: string; message?: string } | null) => fail(error?.code === "42501" ? FORBIDDEN : dbMessage(error ?? {}, SAVE_FAILED));

/* ---------- Chaves de API ---------- */

const KEY_COLUMNS =
  "id, name, description, prefix, scopes, enabled, expires_at, rate_limit, allowed_ips, last_used_at, last_used_ip, rotated_at, revoked_at, created_by, created_at, updated_at";

type KeyRow = Pick<
  Database["public"]["Tables"]["api_keys"]["Row"],
  | "id"
  | "name"
  | "description"
  | "prefix"
  | "scopes"
  | "enabled"
  | "expires_at"
  | "rate_limit"
  | "allowed_ips"
  | "last_used_at"
  | "last_used_ip"
  | "rotated_at"
  | "revoked_at"
  | "created_by"
  | "created_at"
  | "updated_at"
>;

const toKey = (row: KeyRow): ApiKeyView => ({
  id: row.id,
  name: row.name,
  description: row.description,
  prefix: row.prefix,
  scopes: row.scopes as ApiScope[],
  enabled: row.enabled,
  expiresAt: row.expires_at,
  rateLimit: row.rate_limit,
  allowedIps: row.allowed_ips,
  lastUsedAt: row.last_used_at,
  lastUsedIp: row.last_used_ip,
  rotatedAt: row.rotated_at,
  revokedAt: row.revoked_at,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const sameName = (a: string, b: string) => a.toLocaleLowerCase("pt-BR") === b.toLocaleLowerCase("pt-BR");

export async function listApiKeys(client: IntegrationsClient, organizationId: string): Promise<ApiKeyView[]> {
  const { data } = await client.from("api_keys").select(KEY_COLUMNS).eq("organization_id", organizationId).order("created_at", { ascending: false });
  return (data ?? []).map(toKey);
}

function keyValues(input: ApiKeyInput) {
  return {
    name: input.name,
    description: input.description,
    scopes: input.scopes,
    enabled: input.enabled,
    expires_at: input.expiresAt,
    rate_limit: input.rateLimit,
    allowed_ips: input.allowedIps,
  };
}

async function keyProblem(client: IntegrationsClient, organizationId: string, input: ApiKeyInput, current?: KeyRow): Promise<string | null> {
  if (input.expiresAt && input.expiresAt !== current?.expires_at && Date.parse(input.expiresAt) <= Date.now()) return "Escolha uma validade futura.";
  const { data } = await client.from("api_keys").select("id, name").eq("organization_id", organizationId).is("revoked_at", null);
  const others = (data ?? []).filter((key) => key.id !== current?.id);
  if (others.some((key) => sameName(key.name, input.name))) return "Já existe uma chave em uso com esse nome.";
  if (!current && others.length >= MAX_API_KEYS) return `São ${MAX_API_KEYS} chaves em uso, o limite. Revogue alguma antes.`;
  return null;
}

/** Cria a chave e devolve o valor inteiro, que só existe nesta resposta. */
export async function createApiKey(
  client: IntegrationsClient,
  organizationId: string,
  userId: string,
  input: ApiKeyInput,
): Promise<ServiceResult<{ key: ApiKeyView; secret: string }>> {
  const problem = await keyProblem(client, organizationId, input);
  if (problem) return fail(problem);

  const { secret, prefix, hash } = newApiKey();
  const { data, error } = await client
    .from("api_keys")
    .insert({ ...keyValues(input), organization_id: organizationId, prefix, key_hash: hash, created_by: userId })
    .select(KEY_COLUMNS)
    .single();
  if (error || !data) return failure(error);
  return done({ key: toKey(data), secret });
}

async function findKey(client: IntegrationsClient, organizationId: string, id: string) {
  const { data } = await client.from("api_keys").select(KEY_COLUMNS).eq("organization_id", organizationId).eq("id", id).maybeSingle();
  return data;
}

async function patchKey(client: IntegrationsClient, organizationId: string, id: string, values: Database["public"]["Tables"]["api_keys"]["Update"]) {
  const { data, error } = await client
    .from("api_keys")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select(KEY_COLUMNS)
    .maybeSingle();
  if (error) return failure(error);
  if (!data) return fail(FORBIDDEN);
  return done(toKey(data));
}

export async function updateApiKey(client: IntegrationsClient, organizationId: string, id: string, input: ApiKeyInput): Promise<ServiceResult<ApiKeyView>> {
  const current = await findKey(client, organizationId, id);
  if (!current) return fail("Chave não encontrada.");
  if (current.revoked_at) return fail("Uma chave revogada não pode ser editada. Crie outra.");
  const problem = await keyProblem(client, organizationId, input, current);
  if (problem) return fail(problem);
  return patchKey(client, organizationId, id, keyValues(input));
}

export async function setApiKeyEnabled(client: IntegrationsClient, organizationId: string, id: string, enabled: boolean): Promise<ServiceResult<ApiKeyView>> {
  const current = await findKey(client, organizationId, id);
  if (!current) return fail("Chave não encontrada.");
  if (current.revoked_at) return fail("Uma chave revogada não volta a valer.");
  if (enabled && current.expires_at && Date.parse(current.expires_at) <= Date.now()) return fail("A chave expirou. Mude a validade antes de reativar.");
  return patchKey(client, organizationId, id, { enabled });
}

/** Troca o valor da chave: o antigo para de valer na hora, e nome, permissões e limites ficam. */
export async function rotateApiKey(client: IntegrationsClient, organizationId: string, id: string): Promise<ServiceResult<{ key: ApiKeyView; secret: string }>> {
  const current = await findKey(client, organizationId, id);
  if (!current) return fail("Chave não encontrada.");
  if (current.revoked_at) return fail("Uma chave revogada não pode ser renovada.");
  const { secret, prefix, hash } = newApiKey();
  const result = await patchKey(client, organizationId, id, { key_hash: hash, prefix, rotated_at: new Date().toISOString(), last_used_at: null, last_used_ip: null });
  return result.ok ? done({ key: result.data, secret }) : result;
}

/** Revogar é para sempre: a chave fica na lista, com o histórico de chamadas, e nunca mais abre a porta. */
export async function revokeApiKey(client: IntegrationsClient, organizationId: string, id: string): Promise<ServiceResult<ApiKeyView>> {
  const current = await findKey(client, organizationId, id);
  if (!current) return fail("Chave não encontrada.");
  if (current.revoked_at) return fail("Esta chave já foi revogada.");
  return patchKey(client, organizationId, id, { revoked_at: new Date().toISOString(), enabled: false });
}

/** Excluir tira a chave e o registro de chamadas dela; se estava em uso, deixa de valer na hora. */
export async function deleteApiKey(client: IntegrationsClient, organizationId: string, id: string): Promise<ServiceResult<{ id: string }>> {
  const { data, error } = await client.from("api_keys").delete().eq("organization_id", organizationId).eq("id", id).select("id").maybeSingle();
  if (error) return failure(error);
  if (!data) return fail("Chave não encontrada.");
  return done({ id });
}

export async function listApiRequests(client: IntegrationsClient, organizationId: string, keyId?: string): Promise<ApiRequestView[]> {
  let query = client
    .from("api_key_requests")
    .select("id, key_id, method, path, status, code, scope, ip, user_agent, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(REQUESTS_SHOWN);
  if (keyId) query = query.eq("key_id", keyId);
  const { data } = await query;
  return (data ?? []).map((row) => ({
    id: row.id,
    keyId: row.key_id,
    method: row.method,
    path: row.path,
    status: row.status,
    code: row.code,
    scope: row.scope,
    ip: row.ip,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }));
}

/* ---------- Webhooks ---------- */

const WEBHOOK_COLUMNS = "id, description, url, events, active, secret_version, secret_rotated_at, created_at, updated_at";
const DELIVERY_COLUMNS =
  "id, endpoint_id, event_id, event, payload, status, attempts, response_status, response_excerpt, duration_ms, error, redelivery_of, created_at, delivered_at";

type WebhookRow = Pick<
  Database["public"]["Tables"]["webhook_endpoints"]["Row"],
  "id" | "description" | "url" | "events" | "active" | "secret_version" | "secret_rotated_at" | "created_at" | "updated_at"
>;
type DeliveryRow = Omit<Database["public"]["Tables"]["webhook_deliveries"]["Row"], "organization_id">;

const toDelivery = (row: DeliveryRow): WebhookDeliveryView => ({
  id: row.id,
  endpointId: row.endpoint_id,
  eventId: row.event_id,
  event: row.event,
  payload: row.payload,
  status: row.status as DeliveryStatus,
  attempts: row.attempts,
  responseStatus: row.response_status,
  responseExcerpt: row.response_excerpt,
  durationMs: row.duration_ms,
  error: row.error,
  redeliveryOf: row.redelivery_of,
  createdAt: row.created_at,
  deliveredAt: row.delivered_at,
});

const toWebhook = (row: WebhookRow, lastDelivery: WebhookDeliveryView | null = null): WebhookView => ({
  id: row.id,
  description: row.description,
  url: row.url,
  events: row.events as WebhookView["events"],
  active: row.active,
  secretVersion: row.secret_version,
  secretRotatedAt: row.secret_rotated_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastDelivery,
});

export async function listWebhooks(client: IntegrationsClient, organizationId: string): Promise<WebhookView[]> {
  const [{ data: rows }, { data: deliveries }] = await Promise.all([
    client.from("webhook_endpoints").select(WEBHOOK_COLUMNS).eq("organization_id", organizationId).order("created_at"),
    client.from("webhook_deliveries").select(DELIVERY_COLUMNS).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(200),
  ]);
  const last = new Map<string, WebhookDeliveryView>();
  for (const row of deliveries ?? []) if (!last.has(row.endpoint_id)) last.set(row.endpoint_id, toDelivery(row));
  return (rows ?? []).map((row) => toWebhook(row, last.get(row.id) ?? null));
}

export async function listDeliveries(client: IntegrationsClient, organizationId: string, endpointId: string): Promise<WebhookDeliveryView[]> {
  const { data } = await client
    .from("webhook_deliveries")
    .select(DELIVERY_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("endpoint_id", endpointId)
    .order("created_at", { ascending: false })
    .limit(DELIVERIES_SHOWN);
  return (data ?? []).map(toDelivery);
}

/** Cadastra o webhook e devolve o segredo de assinatura, que a tela mostra uma vez para a pessoa copiar. */
export async function createWebhook(
  client: IntegrationsClient,
  organizationId: string,
  userId: string,
  input: WebhookInput,
): Promise<ServiceResult<{ webhook: WebhookView; secret: string }>> {
  const problem = await publicUrlProblem(input.url);
  if (problem) return fail(problem);
  const { count } = await client.from("webhook_endpoints").select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
  if ((count ?? 0) >= MAX_WEBHOOKS) return fail(`Cada equipe cadastra até ${MAX_WEBHOOKS} webhooks. Apague um para cadastrar outro.`);

  const { data, error } = await client
    .from("webhook_endpoints")
    .insert({ organization_id: organizationId, description: input.description, url: input.url, events: input.events, active: input.active, created_by: userId })
    .select(WEBHOOK_COLUMNS)
    .single();
  if (error || !data) return failure(error);
  return done({ webhook: toWebhook(data), secret: webhookSecret(data.id, data.secret_version) });
}

async function patchWebhook(client: IntegrationsClient, organizationId: string, id: string, values: Database["public"]["Tables"]["webhook_endpoints"]["Update"]) {
  const { data, error } = await client
    .from("webhook_endpoints")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select(WEBHOOK_COLUMNS)
    .maybeSingle();
  if (error) return failure(error);
  if (!data) return fail("Webhook não encontrado, ou sem permissão para mexer nele.");
  return done(toWebhook(data));
}

export async function updateWebhook(client: IntegrationsClient, organizationId: string, id: string, input: WebhookInput): Promise<ServiceResult<WebhookView>> {
  const problem = await publicUrlProblem(input.url);
  if (problem) return fail(problem);
  return patchWebhook(client, organizationId, id, { description: input.description, url: input.url, events: input.events, active: input.active });
}

export async function setWebhookActive(client: IntegrationsClient, organizationId: string, id: string, active: boolean): Promise<ServiceResult<WebhookView>> {
  return patchWebhook(client, organizationId, id, { active });
}

/** Gira o segredo: as próximas entregas saem assinadas com o novo, e o antigo para de bater na hora. */
export async function rotateWebhookSecret(client: IntegrationsClient, organizationId: string, id: string): Promise<ServiceResult<{ webhook: WebhookView; secret: string }>> {
  const { data: current } = await client.from("webhook_endpoints").select("secret_version").eq("organization_id", organizationId).eq("id", id).maybeSingle();
  if (!current) return fail("Webhook não encontrado.");
  const result = await patchWebhook(client, organizationId, id, { secret_version: current.secret_version + 1, secret_rotated_at: new Date().toISOString() });
  return result.ok ? done({ webhook: result.data, secret: webhookSecret(id, result.data.secretVersion) }) : result;
}

export async function deleteWebhook(client: IntegrationsClient, organizationId: string, id: string): Promise<ServiceResult<{ id: string }>> {
  const { data, error } = await client.from("webhook_endpoints").delete().eq("organization_id", organizationId).eq("id", id).select("id").maybeSingle();
  if (error) return failure(error);
  if (!data) return fail("Webhook não encontrado, ou sem permissão para apagá-lo.");
  return done({ id });
}

/* ---------- Entregas ---------- */

type Target = Pick<WebhookRow, "id" | "url" | "secret_version">;

/**
 * Leva uma entrega ao destino e grava o que voltou. O corpo é `{ id, event, createdAt, data }`; a assinatura segue
 * o padrão Standard Webhooks (`webhook-id`, `webhook-timestamp`, `webhook-signature`), com o id do evento como id da
 * mensagem, para quem recebe descartar repetição, inclusive de um reenvio.
 */
async function deliver(client: IntegrationsClient, delivery: DeliveryRow, target: Target): Promise<WebhookDeliveryView> {
  const body = JSON.stringify(delivery.payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signWebhook(webhookSecret(target.id, target.secret_version), delivery.event_id, timestamp, body);
  const result = await postJson(
    target.url,
    {
      "User-Agent": "Specular-Webhooks/1.0",
      "X-Specular-Event": delivery.event,
      "X-Specular-Delivery": delivery.id,
      "webhook-id": delivery.event_id,
      "webhook-timestamp": timestamp,
      "webhook-signature": signature,
    },
    body,
  );

  const delivered = result.error === null;
  const { data } = await client
    .from("webhook_deliveries")
    .update({
      status: delivered ? "delivered" : "failed",
      attempts: delivery.attempts + 1,
      response_status: result.status,
      response_excerpt: result.excerpt,
      duration_ms: result.durationMs,
      error: result.error,
      delivered_at: delivered ? new Date().toISOString() : null,
    })
    .eq("id", delivery.id)
    .select(DELIVERY_COLUMNS)
    .maybeSingle();

  return toDelivery(
    data ?? {
      ...delivery,
      status: delivered ? "delivered" : "failed",
      attempts: delivery.attempts + 1,
      response_status: result.status,
      response_excerpt: result.excerpt,
      duration_ms: result.durationMs,
      error: result.error,
    },
  );
}

async function queue(
  client: IntegrationsClient,
  organizationId: string,
  target: Target,
  event: WebhookEvent,
  eventId: string,
  payload: Json,
  redeliveryOf: string | null = null,
) {
  const { data, error } = await client
    .from("webhook_deliveries")
    .insert({ organization_id: organizationId, endpoint_id: target.id, event_id: eventId, event, payload, redelivery_of: redeliveryOf })
    .select(DELIVERY_COLUMNS)
    .single();
  return error || !data ? failure(error) : done(data);
}

const envelope = (eventId: string, event: WebhookEvent, data: Json): Json => ({ id: eventId, event, createdAt: new Date().toISOString(), data });

/** O evento de teste, entregue na hora para a tela dizer o que o destino respondeu. */
export async function testWebhook(client: IntegrationsClient, organizationId: string, id: string): Promise<ServiceResult<WebhookDeliveryView>> {
  const { data: target } = await client.from("webhook_endpoints").select(WEBHOOK_COLUMNS).eq("organization_id", organizationId).eq("id", id).maybeSingle();
  if (!target) return fail("Webhook não encontrado.");
  if (!target.active) return fail("O webhook está pausado. Ative antes de testar.");

  const eventId = randomUUID();
  const payload = envelope(eventId, "teste", { mensagem: "Teste de entrega do Specular", webhook: { id: target.id, descricao: target.description, url: target.url } });
  const queued = await queue(client, organizationId, target, "teste", eventId, payload);
  if (!queued.ok) return queued;
  return done(await deliver(client, queued.data, target));
}

/** Reenvia uma entrega com o mesmo corpo e o mesmo id de evento, num registro novo ligado ao de origem. */
export async function redeliverWebhook(client: IntegrationsClient, organizationId: string, deliveryId: string): Promise<ServiceResult<WebhookDeliveryView>> {
  const { data: original } = await client.from("webhook_deliveries").select(DELIVERY_COLUMNS).eq("organization_id", organizationId).eq("id", deliveryId).maybeSingle();
  if (!original) return fail("Entrega não encontrada.");
  const { data: target } = await client.from("webhook_endpoints").select(WEBHOOK_COLUMNS).eq("organization_id", organizationId).eq("id", original.endpoint_id).maybeSingle();
  if (!target) return fail("O webhook desta entrega não existe mais.");
  if (!target.active) return fail("O webhook está pausado. Ative antes de reenviar.");

  const queued = await queue(client, organizationId, target, original.event as WebhookEvent, original.event_id, original.payload, original.id);
  if (!queued.ok) return queued;
  return done(await deliver(client, queued.data, target));
}

async function fanOut(organizationId: string, event: Exclude<WebhookEvent, "teste">, data: Json) {
  const admin = createAdminClient();
  const { data: targets } = await admin
    .from("webhook_endpoints")
    .select(WEBHOOK_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("active", true)
    .contains("events", [event]);
  if (!targets?.length) return;

  const eventId = randomUUID();
  const payload = envelope(eventId, event, data);
  await Promise.all(
    targets.map(async (target) => {
      const queued = await queue(admin, organizationId, target, event, eventId, payload);
      if (queued.ok) await deliver(admin, queued.data, target);
    }),
  );
}

/**
 * Um evento da casa aconteceu: todo webhook ativo que o assina recebe. Quem chama não espera nem quebra se falhar;
 * o resultado fica na entrega. Dentro de uma requisição o envio vai para depois da resposta (`after`), para a tela
 * de quem salvou não esperar o destino de fora; fora dela, segue solto.
 */
export function emitWebhookEvent(organizationId: string, event: Exclude<WebhookEvent, "teste">, data: Json) {
  if (!organizationId) return;
  const run = () => fanOut(organizationId, event, data).catch((error: unknown) => console.error(`webhook ${event} falhou:`, error));
  try {
    after(run);
  } catch {
    void run();
  }
}

export const apiBaseUrl = () => `${siteConfig.url}/api/v1`;
