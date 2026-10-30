import "server-only";
import { checkRateLimit, clientIp, rateLimitHeaders } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { apiKeyStatus, type ApiScope } from "./catalog";
import { apiKeyHash, isApiKey } from "./secrets";

/**
 * A porta de entrada da `api/v1` para uma chave de API (2026-10-29).
 *
 * Com o token de sessão, quem decide o acesso é a RLS, pelo JWT da pessoa. A chave não tem JWT: ela é da equipe, e
 * por isso a rota só a aceita quando declara o escopo que pede, e a leitura e a escrita correm pela chave secreta do
 * servidor, presas à equipe da chave pelo `organization_id` que todo serviço da casa já filtra. É também por isso
 * que só entram no catálogo de escopos rotas cujo serviço filtra pela equipe e não depende de quem está logado.
 *
 * A chave age em nome de quem a criou: se essa pessoa sair da equipe, a chave para de abrir a porta. Toda chamada
 * com uma chave conhecida fica no registro, liberada ou recusada, com o código da recusa.
 */

export type ApiKeyCaller = { id: string; name: string; scopes: ApiScope[] };

type Denied = { response: Response };
type Granted = { organizationId: string; userId: string; apiKey: ApiKeyCaller };

/** O registro guarda trinta dias; a limpeza roda de vez em quando, na própria chamada. */
const RETENTION_DAYS = 30;
const CLEANUP_CHANCE = 0.01;

const messages: Record<string, string> = {
  chave_invalida: "Chave de API inválida",
  chave_revogada: "Chave de API revogada",
  chave_expirada: "Chave de API expirada",
  chave_pausada: "Chave de API pausada",
  chave_sem_dono: "Quem criou esta chave não está mais na equipe",
  ip_nao_permitido: "Este endereço IP não está liberado para a chave",
  rota_sem_chave: "Esta rota não aceita chave de API, só a sessão de uma pessoa",
  escopo_ausente: "A chave não tem a permissão que esta rota pede",
  limite_excedido: "Limite de chamadas por minuto da chave excedido",
};

export async function authorizeApiKey(request: Request, token: string, scope?: ApiScope): Promise<Granted | Denied> {
  const deny = (status: number, code: string, headers?: Record<string, string>): Denied => ({
    response: Response.json({ error: messages[code] ?? "Acesso negado", code }, { status, headers }),
  });
  if (!isApiKey(token)) return deny(401, "chave_invalida");

  const admin = createAdminClient();
  const { data: key } = await admin
    .from("api_keys")
    .select("id, organization_id, name, scopes, enabled, expires_at, revoked_at, rate_limit, allowed_ips, created_by")
    .eq("key_hash", apiKeyHash(token))
    .maybeSingle();
  if (!key) return deny(401, "chave_invalida");

  const url = new URL(request.url);
  const ip = clientIp(request.headers);
  const log = async (status: number, code: string | null) => {
    const now = new Date().toISOString();
    await Promise.all([
      admin.from("api_key_requests").insert({
        organization_id: key.organization_id,
        key_id: key.id,
        method: request.method.slice(0, 10),
        path: `${url.pathname}${url.search}`.slice(0, 300),
        status,
        code,
        scope: scope ?? null,
        ip: ip.slice(0, 64),
        user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      }),
      status === 200 ? admin.from("api_keys").update({ last_used_at: now, last_used_ip: ip.slice(0, 64) }).eq("id", key.id) : null,
      Math.random() < CLEANUP_CHANCE
        ? admin
            .from("api_key_requests")
            .delete()
            .eq("organization_id", key.organization_id)
            .lt("created_at", new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString())
        : null,
    ]);
  };
  const refuse = async (status: number, code: string, headers?: Record<string, string>) => {
    await log(status, code);
    return deny(status, code, headers);
  };

  const state = apiKeyStatus({ revokedAt: key.revoked_at, expiresAt: key.expires_at, enabled: key.enabled });
  if (state !== "active") return refuse(401, state === "revoked" ? "chave_revogada" : state === "expired" ? "chave_expirada" : "chave_pausada");

  const { data: member } = key.created_by
    ? await admin.from("organization_members").select("user_id").eq("organization_id", key.organization_id).eq("user_id", key.created_by).maybeSingle()
    : { data: null };
  if (!member || !key.created_by) return refuse(401, "chave_sem_dono");

  if (key.allowed_ips.length > 0 && !key.allowed_ips.includes(ip)) return refuse(403, "ip_nao_permitido");
  if (!scope) return refuse(403, "rota_sem_chave");
  if (!key.scopes.includes(scope)) return refuse(403, "escopo_ausente");

  const limit = await checkRateLimit("apiKey", key.id, crypto.randomUUID(), { limit: key.rate_limit, windowSeconds: 60 });
  if (!limit.allowed) return refuse(429, "limite_excedido", rateLimitHeaders(limit));

  await log(200, null);
  return { organizationId: key.organization_id, userId: key.created_by, apiKey: { id: key.id, name: key.name, scopes: key.scopes as ApiScope[] } };
}
