import { intakeFormSchema } from "@/features/forms/schemas";
import { listIntakeForms, saveIntakeForm } from "@/features/forms/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "forms-read");
  if ("response" in auth) return auth.response;
  return Response.json(await listIntakeForms(auth.session.supabase, auth.session.organizationId));
}

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "forms-write");
  if ("response" in auth) return auth.response;
  const body = await readPayload(request, intakeFormSchema);
  if ("response" in body) return body.response;
  return fromMutation(
    await saveIntakeForm(auth.session.supabase, auth.session.organizationId, auth.session.userId, body.data),
    auth.session.organizationId,
    ["forms"],
  );
}
