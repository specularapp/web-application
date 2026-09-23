import { getProjectTracking } from "@/features/projects/tracking";
import { checkRateLimit, clientIp, rateLimitHeaders } from "@/lib/security/rate-limit";
import { isShareToken } from "@/lib/security/share-token";
import { createAdminClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: Context) {
  const { token } = await params;
  if (!isShareToken(token)) return Response.json({ error: "Acompanhamento não encontrado" }, { status: 404 });
  const limit = await checkRateLimit("publicLink", `project-api:${clientIp(request.headers)}`, crypto.randomUUID());
  if (!limit.allowed) return Response.json({ error: "Muitas tentativas" }, { status: 429, headers: rateLimitHeaders(limit) });
  const tracking = await getProjectTracking(createAdminClient(), token);
  return tracking ? Response.json(tracking, { headers: rateLimitHeaders(limit) }) : Response.json({ error: "Acompanhamento não encontrado" }, { status: 404 });
}
