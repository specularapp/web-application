import "server-only";
import { organizationForApi, revalidateDomain } from "@/features/organizations/context";
import type { DomainTag } from "@/lib/cache/tags";
import { authorizeRequest, invalidPayload, readJson } from "./v1";
import type { ApiSession } from "./v1";
import type { RateLimitScope } from "@/lib/security/rate-limit";

/**
 * A porta de entrada de todo endpoint de domínio da v1, que é por onde o aplicativo fala: token do Supabase
 * no cabeçalho, teto de requisições por pessoa, RLS valendo pelo JWT e o time em vigor resolvido do mesmo
 * jeito que a web resolve. Sem isto, cada rota repetiria as três linhas e uma delas acabaria esquecendo o
 * time, que é justamente a que devolveria a conta errada.
 */
export type DomainSession = ApiSession & { organizationId: string };

export async function authorizeDomain(
  request: Request,
  operation: string,
  scope: RateLimitScope = "action",
): Promise<{ session: DomainSession } | { response: Response }> {
  const auth = await authorizeRequest(request, operation, scope);
  if ("response" in auth) return auth;

  const organizationId = await organizationForApi(auth.session.supabase, auth.session.userId);
  if (!organizationId) return { response: Response.json({ error: "Sem time em vigor" }, { status: 409 }) };

  return { session: { ...auth.session, organizationId } };
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
