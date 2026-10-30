/** Renovar uma chave de API pelo aplicativo (2026-10-29): devolve o valor novo, que só existe nesta resposta. */
import { integrationIdSchema } from "@/features/integrations/schemas";
import { rotateApiKey } from "@/features/integrations/service";
import { authorizeDomain, fromMutation } from "@/lib/api/domain";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "api-key-rotate");
  if ("response" in auth) return auth.response;

  const parsed = integrationIdSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "Chave inválida" }, { status: 400 });

  return fromMutation(await rotateApiKey(auth.session.supabase, auth.session.organizationId, parsed.data.id), auth.session.organizationId, []);
}
