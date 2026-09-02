import "server-only";
import { readTextWithLimit } from "@/lib/security/payload";
import { checkRateLimit, rateLimitHeaders, type RateLimitScope } from "@/lib/security/rate-limit";
import { createClientFromRequest } from "@/lib/supabase/api";

const MAX_BODY_BYTES = 8192;

type Authorized = Awaited<ReturnType<typeof createClientFromRequest>>;

export type ApiSession = NonNullable<Authorized> & { userId: string };

// Mesma porta de entrada para todo endpoint da v1, que é por onde o aplicativo vai falar:
// token do Supabase no cabeçalho, RLS valendo pelo JWT e teto de requisições por pessoa.
export async function authorizeRequest(
  request: Request,
  operation: string,
  scope: RateLimitScope = "action",
): Promise<{ session: ApiSession } | { response: Response }> {
  const authorized = await createClientFromRequest(request);
  if (!authorized) return { response: Response.json({ error: "Não autenticado" }, { status: 401 }) };

  const userId = String(authorized.claims.sub);
  const limit = await checkRateLimit(scope, `${operation}:${userId}`, crypto.randomUUID());
  if (!limit.allowed) {
    return {
      response: Response.json({ error: "Muitas requisições" }, { status: 429, headers: rateLimitHeaders(limit) }),
    };
  }

  return { session: { ...authorized, userId } };
}

export async function readJson(request: Request): Promise<unknown> {
  const body = await readTextWithLimit(request, MAX_BODY_BYTES).catch(() => null);
  if (body === null) return null;

  try {
    return JSON.parse(body || "{}") as unknown;
  } catch {
    return null;
  }
}

export function invalidPayload() {
  return Response.json({ error: "Dados inválidos" }, { status: 422 });
}
