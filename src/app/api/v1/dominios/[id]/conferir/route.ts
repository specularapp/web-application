/** Conferir o DNS de um domínio do portfólio pelo aplicativo (2026-10-29), pelo mesmo serviço da web. */
import { verifyPortfolioDomain } from "@/features/settings/domains-service";
import { domainIdSchema } from "@/features/settings/schemas";
import { authorizeDomain, fromMutation } from "@/lib/api/domain";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "domain-verify");
  if ("response" in auth) return auth.response;

  const parsed = domainIdSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "Domínio inválido" }, { status: 400 });

  return fromMutation(await verifyPortfolioDomain(auth.session.supabase, auth.session.organizationId, parsed.data.id), auth.session.organizationId, ["organization"]);
}
