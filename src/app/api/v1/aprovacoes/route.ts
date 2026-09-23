import { createApprovalSchema } from "@/features/approvals/schemas";
import { createApproval, listApprovals } from "@/features/approvals/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "approvals-read");
  if ("response" in auth) return auth.response;
  return Response.json(await listApprovals(auth.session.supabase, auth.session.organizationId));
}

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "approvals-write");
  if ("response" in auth) return auth.response;
  const body = await readPayload(request, createApprovalSchema);
  if ("response" in body) return body.response;
  return fromMutation(await createApproval(auth.session.supabase, auth.session.organizationId, auth.session.userId, body.data), auth.session.organizationId, ["approvals"]);
}
