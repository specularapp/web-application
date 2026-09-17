/**
 * As cobranças para o aplicativo. Mesma regra da web, pelo mesmo `service.ts`: aqui só muda a casca, que
 * autentica por Bearer em vez de sessão em cookie. A RLS continua decidindo o acesso, porque o cliente
 * carrega o JWT de quem pediu.
 */
import { createChargeSchema } from "@/features/finance/schemas";
import { createCharge, listCharges } from "@/features/finance/service";
import { authorizeDomain, readPayload } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "charges-read");
  if ("response" in auth) return auth.response;

  const charges = await listCharges(auth.session.supabase, auth.session.organizationId);
  return Response.json({ charges });
}

export async function POST(request: Request) {
  const auth = await authorizeDomain(request, "charges-write", "billing");
  if ("response" in auth) return auth.response;

  const body = await readPayload(request, createChargeSchema);
  if ("response" in body) return body.response;

  const result = await createCharge(auth.session.supabase, auth.session.organizationId, auth.session.userId, body.data);
  return result.ok ? Response.json(result.charge) : Response.json({ error: result.error }, { status: 400 });
}
