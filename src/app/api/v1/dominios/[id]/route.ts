/** Tirar um domínio do portfólio pelo aplicativo (2026-10-29), pelo mesmo serviço da web. */
import { removePortfolioDomain } from "@/features/settings/domains-service";
import { domainIdSchema } from "@/features/settings/schemas";
import { authorizeDomain, fromMutation } from "@/lib/api/domain";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "domain-remove");
  if ("response" in auth) return auth.response;

  const parsed = domainIdSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "Domínio inválido" }, { status: 400 });

  return fromMutation(await removePortfolioDomain(auth.session.supabase, auth.session.organizationId, parsed.data.id), auth.session.organizationId, ["organization"]);
}
