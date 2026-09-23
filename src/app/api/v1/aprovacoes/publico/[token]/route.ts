import { submitApprovalDecisionSchema } from "@/features/approvals/schemas";
import { getPublicApproval, submitPublicApprovalDecision } from "@/features/approvals/service";
import { readPayload } from "@/lib/api/domain";
import { checkRateLimit, clientIp, rateLimitHeaders } from "@/lib/security/rate-limit";
import { isShareToken } from "@/lib/security/share-token";
import { createAdminClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: Context) {
  const { token } = await params;
  if (!isShareToken(token)) return Response.json({ error: "Link inválido" }, { status: 404 });
  const limit = await checkRateLimit("publicLink", `approval-api-load:${clientIp(request.headers)}`, crypto.randomUUID());
  if (!limit.allowed) return Response.json({ error: "Muitas tentativas" }, { status: 429, headers: rateLimitHeaders(limit) });
  const data = await getPublicApproval(createAdminClient(), token);
  return data ? Response.json(data, { headers: rateLimitHeaders(limit) }) : Response.json({ error: "Aprovação não encontrada" }, { status: 404, headers: rateLimitHeaders(limit) });
}

export async function POST(request: Request, { params }: Context) {
  const { token } = await params;
  if (!isShareToken(token)) return Response.json({ error: "Link inválido" }, { status: 404 });
  const limit = await checkRateLimit("publicForm", `approval-api-submit:${token.slice(0, 12)}:${clientIp(request.headers)}`, crypto.randomUUID());
  if (!limit.allowed) return Response.json({ error: "Muitas tentativas" }, { status: 429, headers: rateLimitHeaders(limit) });
  const body = await readPayload(request, submitApprovalDecisionSchema);
  if ("response" in body) return body.response;
  const result = await submitPublicApprovalDecision(createAdminClient(), token, body.data);
  return result.ok
    ? Response.json({ id: result.data }, { status: 201, headers: rateLimitHeaders(limit) })
    : Response.json({ error: result.error }, { status: 400, headers: rateLimitHeaders(limit) });
}
