/** Revogar uma chave de API pelo aplicativo (2026-10-29): para sempre, como na tela. */
import { integrationIdSchema } from "@/features/integrations/schemas";
import { revokeApiKey } from "@/features/integrations/service";
import { authorizeDomain, fromMutation } from "@/lib/api/domain";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "api-key-revoke");
  if ("response" in auth) return auth.response;

  const parsed = integrationIdSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "Chave inválida" }, { status: 400 });

  return fromMutation(await revokeApiKey(auth.session.supabase, auth.session.organizationId, parsed.data.id), auth.session.organizationId, []);
}
