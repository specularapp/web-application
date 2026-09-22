/**
 * As cobranças para o aplicativo. Mesma regra da web, pelo mesmo `service.ts`: aqui só muda a casca, que
 * autentica por Bearer em vez de sessão em cookie. A RLS continua decidindo o acesso, porque o cliente
 * carrega o JWT de quem pediu.
 */
import { createChargeSchema } from "@/features/finance/schemas";
import { createCharge, listCharges } from "@/features/finance/service";
import { authorizeDomain, fromMutation, readPayload } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "charges-read");
  if ("response" in auth) return auth.response;

  const charges = await listCharges(auth.session.supabase, auth.session.organizationId);
  return Response.json({ charges: charges.filter((charge) => charge.direction === "incoming") });
}

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "charges-write", "billing");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, createChargeSchema);
  if ("response" in body) return body.response;
  if (body.data.direction !== "incoming") return Response.json({ error: "Use o endpoint de despesas para saídas." }, { status: 400 });

  const result = await createCharge(auth.session.supabase, auth.session.organizationId, auth.session.userId, body.data);
  return fromMutation(result.ok ? { ok: true, data: result.charge } : result, auth.session.organizationId, ["finance"]);
}
