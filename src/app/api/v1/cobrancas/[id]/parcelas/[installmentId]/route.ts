import { payInstallmentSchema, installmentRefSchema } from "@/features/finance/schemas";
import { payInstallment, reopenInstallment } from "@/features/finance/service";
import { revalidateDomain } from "@/features/organizations/context";
import { authorizeDomain } from "@/lib/api/domain";
import { readJson } from "@/lib/api/v1";
import { cacheTags } from "@/lib/cache/tags";

type Context = { params: Promise<{ id: string; installmentId: string }> };

export async function POST(request: Request, context: Context) {
  const auth = await authorizeDomain(request, "charge-pay");
  if ("response" in auth) return auth.response;
  const input = await readJson(request);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return Response.json({ error: "Confira os dados do pagamento" }, { status: 422 });
  }
  const parsed = payInstallmentSchema.safeParse({
    method: null, paidOn: null,
    ...input,
    ...await context.params,
  });
  if (!parsed.success) return Response.json({ error: "Confira os dados do pagamento" }, { status: 422 });
  const { supabase, organizationId, userId } = auth.session;
  const result = await payInstallment(supabase, organizationId, userId, parsed.data);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  await revalidateDomain(organizationId, [cacheTags.finance], ["/cobrancas", "/despesas", "/financeiro"], false);
  return Response.json(result);
}

export async function DELETE(request: Request, context: Context) {
  const auth = await authorizeDomain(request, "charge-reopen");
  if ("response" in auth) return auth.response;
  const body = installmentRefSchema.safeParse(await context.params);
  if (!body.success) return Response.json({ error: "Parcela inválida" }, { status: 422 });
  const { supabase, organizationId } = auth.session;
  const result = await reopenInstallment(supabase, organizationId, body.data.id, body.data.installmentId);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  await revalidateDomain(organizationId, [cacheTags.finance], ["/cobrancas", "/despesas", "/financeiro"], false);
  return Response.json(result);
}
