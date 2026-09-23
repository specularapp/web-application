import { intakeFormSchema } from "@/features/forms/schemas";
import { deleteIntakeForm, getIntakeForm, saveIntakeForm } from "@/features/forms/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const auth = await authorizeDomain(request, "forms-read");
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const form = await getIntakeForm(auth.session.supabase, auth.session.organizationId, id);
  return form ? Response.json(form) : Response.json({ error: "Formulário não encontrado" }, { status: 404 });
}

export async function PATCH(request: Request, { params }: Context) {
  const auth = await authorizeDomain(request, "forms-write");
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const body = await readPayload(request, intakeFormSchema);
  if ("response" in body) return body.response;
  return fromMutation(
    await saveIntakeForm(auth.session.supabase, auth.session.organizationId, auth.session.userId, { ...body.data, id }),
    auth.session.organizationId,
    ["forms"],
  );
}

export async function DELETE(request: Request, { params }: Context) {
  const auth = await authorizeDomain(request, "forms-write");
  if ("response" in auth) return auth.response;
  const { id } = await params;
  return fromMutation(await deleteIntakeForm(auth.session.supabase, auth.session.organizationId, id), auth.session.organizationId, ["forms"]);
}
