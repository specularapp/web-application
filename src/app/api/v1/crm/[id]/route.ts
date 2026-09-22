import { opportunityMoveSchema } from "@/features/crm/schemas";
import { getOpportunity, moveOpportunity } from "@/features/crm/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "crm-opportunity-move");
  if ("response" in auth) return auth.response;
  const body = await readPayload(request, opportunityMoveSchema);
  if ("response" in body) return body.response;
  if (body.data.id !== (await params).id) return Response.json({ error: "Oportunidade divergente" }, { status: 422 });
  return fromMutation(await moveOpportunity(auth.session.supabase, auth.session.organizationId, body.data.id, body.data.stage), auth.session.organizationId, ["crm"]);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeDomain(request, "crm-opportunity-read");
  if ("response" in auth) return auth.response;
  const opportunity = await getOpportunity(auth.session.supabase, auth.session.organizationId, (await params).id);
  return opportunity ? Response.json(opportunity) : Response.json({ error: "Oportunidade não encontrada" }, { status: 404 });
}
