/**
 * O assistente para o aplicativo. Mesma regra da web, pelo mesmo `service.ts`: aqui só muda a casca, que
 * autentica por Bearer em vez de sessão em cookie. A RLS continua decidindo o acesso, porque o cliente
 * carrega o JWT de quem pediu.
 */
import { askAiSchema } from "@/features/ai/schemas";
import type { AiScopeId } from "@/features/ai/scope";
import { ask, getAiUsage, listConversations } from "@/features/ai/service";
import { hasAi } from "@/lib/env";
import { authorizeDomain, readPayload } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "ai-read");
  if ("response" in auth) return auth.response;

  const [usage, conversations] = await Promise.all([
    getAiUsage(auth.session.supabase, auth.session.organizationId),
    listConversations(auth.session.supabase, auth.session.userId),
  ]);

  return Response.json({ usage, conversations });
}

export async function POST(request: Request) {
  if (!hasAi()) return Response.json({ error: "O assistente não está configurado" }, { status: 503 });

  const auth = await authorizeDomain(request, "ai-ask", "ai");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, askAiSchema);
  if ("response" in body) return body.response;

  const result = await ask(auth.session.supabase, auth.session.organizationId, auth.session.userId, {
    ...body.data,
    scope: body.data.scope as AiScopeId[],
  });

  return result.ok ? Response.json(result) : Response.json({ error: result.error }, { status: 400 });
}
