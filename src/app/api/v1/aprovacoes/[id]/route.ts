import { createApprovalVersionBodySchema } from "@/features/approvals/schemas";
import { createApprovalVersion, getApproval } from "@/features/approvals/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const auth = await authorizeDomain(request, "approvals-read");
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const data = await getApproval(auth.session.supabase, auth.session.organizationId, id);
  return data ? Response.json(data) : Response.json({ error: "Aprovação não encontrada" }, { status: 404 });
}

export async function POST(request: Request, { params }: Context) {
  const auth = await authorizeDomain(request, "approvals-write");
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const body = await readPayload(request, createApprovalVersionBodySchema);
  if ("response" in body) return body.response;
  return fromMutation(await createApprovalVersion(auth.session.supabase, auth.session.organizationId, auth.session.userId, { ...body.data, approvalId: id }), auth.session.organizationId, ["approvals"]);
}
