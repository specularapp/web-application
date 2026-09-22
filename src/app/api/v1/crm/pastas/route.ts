import { saveCrmFolderSchema } from "@/features/crm/schemas";
import { saveCrmFolder } from "@/features/crm/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "crm-folder-save");
  if ("response" in auth) return auth.response;
  const body = await readPayload(request, saveCrmFolderSchema);
  if ("response" in body) return body.response;
  return fromMutation(await saveCrmFolder(auth.session.supabase, auth.session.organizationId, body.data), auth.session.organizationId, ["crm"]);
}
