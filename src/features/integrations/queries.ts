import "server-only";
import { requireOrganization } from "@/features/organizations/context";
import type { ApiKeyView, ApiRequestView, WebhookView } from "./catalog";
import { apiBaseUrl, listApiKeys, listApiRequests, listWebhooks } from "./service";

/*
 * O que cada página de integração precisa, de uma vez (2026-10-29). Sem cache, como as outras configurações: são
 * listas escritas ali mesmo, e a leitura seguinte precisa ver o que acabou de mudar. Quem pode mexer é dono ou
 * administrador; a RLS confere de novo na escrita, e as chaves nem aparecem para quem não pode.
 */

export type ApiSettings = { keys: ApiKeyView[]; requests: ApiRequestView[]; baseUrl: string; canManage: boolean };

export async function getApiSettings(): Promise<ApiSettings> {
  const { supabase, organizationId, role } = await requireOrganization("/configuracoes/integracoes/api");
  const [keys, requests] = await Promise.all([listApiKeys(supabase, organizationId), listApiRequests(supabase, organizationId)]);
  return { keys, requests, baseUrl: apiBaseUrl(), canManage: role === "owner" || role === "admin" };
}

export type WebhooksSettings = { webhooks: WebhookView[]; canManage: boolean };

export async function getWebhooksSettings(): Promise<WebhooksSettings> {
  const { supabase, organizationId, role } = await requireOrganization("/configuracoes/integracoes/webhooks");
  return { webhooks: await listWebhooks(supabase, organizationId), canManage: role === "owner" || role === "admin" };
}
