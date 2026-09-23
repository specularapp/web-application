import { attachApprovalAssetSchema, prepareApprovalAssetSchema, publishApprovalVersionSchema } from "@/features/approvals/schemas";
import { attachApprovalAsset, prepareApprovalAsset, publishApprovalVersion } from "@/features/approvals/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "approvals-write");
  if ("response" in auth) return auth.response;
  const body = await readPayload(request, prepareApprovalAssetSchema);
  if ("response" in body) return body.response;
  return fromMutation(await prepareApprovalAsset(auth.session.supabase, auth.session.organizationId, body.data.versionId, body.data.contentType), auth.session.organizationId, ["approvals"]);
}

export async function PATCH(request: Request) {
  const auth = await authorizeDomain(request, "approvals-write");
  if ("response" in auth) return auth.response;
  const body = await readPayload(request, attachApprovalAssetSchema);
  if ("response" in body) return body.response;
  return fromMutation(await attachApprovalAsset(auth.session.supabase, auth.session.organizationId, body.data), auth.session.organizationId, ["approvals"]);
}

export async function PUT(request: Request) {
  const auth = await authorizeDomain(request, "approvals-write");
  if ("response" in auth) return auth.response;
  const body = await readPayload(request, publishApprovalVersionSchema);
  if ("response" in body) return body.response;
  return fromMutation(await publishApprovalVersion(auth.session.supabase, auth.session.organizationId, auth.session.userId, body.data.versionId), auth.session.organizationId, ["approvals"]);
}
