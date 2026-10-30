/** As cem últimas entregas de um webhook (2026-10-29), com o corpo e o que o destino respondeu. */
import { integrationIdSchema } from "@/features/integrations/schemas";
import { listDeliveries } from "@/features/integrations/service";
import { authorizeDomain } from "@/lib/api/domain";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "webhook-deliveries", "action", "webhooks:ler");
  if ("response" in auth) return auth.response;

  const parsed = integrationIdSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "Webhook inválido" }, { status: 400 });

  return Response.json({ deliveries: await listDeliveries(auth.session.supabase, auth.session.organizationId, parsed.data.id) });
}
