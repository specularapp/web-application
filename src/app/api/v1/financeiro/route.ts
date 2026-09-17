/**
 * A visão geral do financeiro para o aplicativo. Mesma regra da web, pelo mesmo `service.ts`: aqui só muda a casca, que
 * autentica por Bearer em vez de sessão em cookie. A RLS continua decidindo o acesso, porque o cliente
 * carrega o JWT de quem pediu.
 */
import { financePeriodSchema } from "@/features/finance/schemas";
import { getFinanceOverview } from "@/features/finance/service";
import { authorizeDomain } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "finance-read");
  if ("response" in auth) return auth.response;

  const period = financePeriodSchema.parse(new URL(request.url).searchParams.get("periodo") ?? undefined);
  const overview = await getFinanceOverview(auth.session.supabase, auth.session.organizationId, period);

  return Response.json(overview);
}
