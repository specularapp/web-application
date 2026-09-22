import { configureFunnelStagesSchema, saveFunnelSchema } from "@/features/crm/schemas";
import { configureFunnelStages, getCrmTree, saveFunnel } from "@/features/crm/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "crm-funnels-read");
  if ("response" in auth) return auth.response;
  return Response.json(await getCrmTree(auth.session.supabase, auth.session.organizationId));
}

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "crm-funnel-save");
  if ("response" in auth) return auth.response;
  const body = await readPayload(request, saveFunnelSchema);
  if ("response" in body) return body.response;
  return fromMutation(await saveFunnel(auth.session.supabase, auth.session.organizationId, body.data), auth.session.organizationId, ["crm"]);
}

export async function PATCH(request: Request) {
  const auth = await authorizeDomain(request, "crm-funnel-stages");
  if ("response" in auth) return auth.response;
  const body = await readPayload(request, configureFunnelStagesSchema);
  if ("response" in body) return body.response;
  return fromMutation(await configureFunnelStages(auth.session.supabase, auth.session.organizationId, body.data), auth.session.organizationId, ["crm"]);
}
