/** O registro de chamadas feitas com chave de API (2026-10-29), as duzentas últimas; `?chave=<id>` filtra uma. */
import { apiRequestsQuerySchema } from "@/features/integrations/schemas";
import { listApiRequests } from "@/features/integrations/service";
import { authorizeDomain } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "api-requests-read");
  if ("response" in auth) return auth.response;

  const parsed = apiRequestsQuerySchema.safeParse({ keyId: new URL(request.url).searchParams.get("chave") ?? undefined });
  if (!parsed.success) return Response.json({ error: "Chave inválida" }, { status: 400 });

  return Response.json({ requests: await listApiRequests(auth.session.supabase, auth.session.organizationId, parsed.data.keyId) });
}
