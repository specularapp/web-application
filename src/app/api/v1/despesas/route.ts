/** Contas a pagar para o aplicativo, usando a mesma regra de parcelas do financeiro. */
import { createChargeSchema } from "@/features/finance/schemas";
import { createCharge, listCharges } from "@/features/finance/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "charges-read");
  if ("response" in auth) return auth.response;
  const charges = await listCharges(auth.session.supabase, auth.session.organizationId);
  return Response.json({ expenses: charges.filter((charge) => charge.direction === "outgoing") });
}

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "charges-write", "billing");
  if ("response" in auth) return auth.response;
  const body = await readPayload(request, createChargeSchema);
  if ("response" in body) return body.response;
  if (!body.data.clientId && !body.data.partyName.trim()) return Response.json({ error: "Informe o fornecedor da despesa." }, { status: 400 });

  const result = await createCharge(auth.session.supabase, auth.session.organizationId, auth.session.userId, { ...body.data, direction: "outgoing", quoteId: null });
  return fromMutation(result.ok ? { ok: true, data: result.charge } : result, auth.session.organizationId, ["finance"]);
}
