import "server-only";
import { authorizeApiKey, type ApiKeyCaller } from "@/features/integrations/access";
import type { ApiScope } from "@/features/integrations/catalog";
import { looksLikeApiKey } from "@/features/integrations/secrets";
import { organizationForApi, revalidateDomain } from "@/features/organizations/context";
import type { DomainTag } from "@/lib/cache/tags";
import { createAdminClient } from "@/lib/supabase/server";
import { authorizeRequest, invalidPayload, readJson } from "./v1";
import type { ApiSession } from "./v1";
import type { RateLimitScope } from "@/lib/security/rate-limit";

/**
 * A porta de entrada de todo endpoint de domínio da v1, que é por onde o aplicativo fala: token do Supabase
 * no cabeçalho, teto de requisições por pessoa, RLS valendo pelo JWT e o time em vigor resolvido do mesmo
 * jeito que a web resolve. Sem isto, cada rota repetiria as três linhas e uma delas acabaria esquecendo o
 * time, que é justamente a que devolveria a conta errada.
 */
export type DomainSession = Pick<ApiSession, "supabase" | "userId"> & {
  organizationId: string;
  /** A chave de API que chamou, quando a chamada veio de um sistema de fora e não da sessão de uma pessoa. */
  apiKey: ApiKeyCaller | null;
};

/**
 * `apiScope` é o que abre a rota para uma chave de API (2026-10-29): sem ele, a rota só aceita a sessão de uma
 * pessoa e a chave recebe 403. Com a chave a leitura corre pela chave secreta do servidor, presa à equipe da chave;
 * a regra está em `features/integrations/access.ts`.
 */
export async function authorizeDomain(
  request: Request,
  operation: string,
  scope: RateLimitScope = "action",
  apiScope?: ApiScope,
): Promise<{ session: DomainSession } | { response: Response }> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (looksLikeApiKey(token)) {
    const access = await authorizeApiKey(request, token, apiScope);
    if ("response" in access) return access;
    return { session: { supabase: createAdminClient(), userId: access.userId, organizationId: access.organizationId, apiKey: access.apiKey } };
  }

  const auth = await authorizeRequest(request, operation, scope);
  if ("response" in auth) return auth;

  const organizationId = await organizationForApi(auth.session.supabase, auth.session.userId);
  if (!organizationId) return { response: Response.json({ error: "Sem time em vigor" }, { status: 409 }) };

  return { session: { supabase: auth.session.supabase, userId: auth.session.userId, organizationId, apiKey: null } };
}

/** O corpo lido e fechado pelo zod, no formato que as rotas já usam. */
export async function readPayload<T>(request: Request, schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }) {
  const parsed = schema.safeParse(await readJson(request));
  return parsed.success ? { data: parsed.data } : { response: invalidPayload() };
}

/** A resposta de um `ServiceResult`: o dado com 200, o erro com 400 e a mensagem que o serviço escreveu. */
export function fromResult<T>(result: { ok: true; data: T } | { ok: false; error: string }) {
  return result.ok ? Response.json(result.data ?? { ok: true }) : Response.json({ error: result.error }, { status: 400 });
}

export async function fromMutation<T>(result: { ok: true; data: T } | { ok: false; error: string }, organizationId: string, tags: DomainTag[]) {
  if (result.ok) await revalidateDomain(organizationId, tags, [], false);
  return fromResult(result);
}
