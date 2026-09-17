/**
 * O painel para o aplicativo. Mesma regra da web, pelo mesmo `service.ts`: aqui só muda a casca, que
 * autentica por Bearer em vez de sessão em cookie. A RLS continua decidindo o acesso, porque o cliente
 * carrega o JWT de quem pediu.
 */
import { getClientsSummary } from "@/features/clients/service";
import { getFinanceSummary } from "@/features/finance/service";
import { getTeamSummary } from "@/features/organizations/service";
import { getProjectsSummary } from "@/features/projects/service";
import { getQuotesSummary } from "@/features/quotes/service";
import { getTasksSummary } from "@/features/tasks/service";
import { authorizeDomain } from "@/lib/api/domain";

export async function GET(request: Request) {
  const auth = await authorizeDomain(request, "dashboard-read");
  if ("response" in auth) return auth.response;

  const { supabase, organizationId, userId } = auth.session;
  const [projects, finance, clients, tasks, team, quotes] = await Promise.all([
    getProjectsSummary(supabase, organizationId),
    getFinanceSummary(supabase, organizationId),
    getClientsSummary(supabase, organizationId),
    getTasksSummary(supabase, organizationId),
    getTeamSummary(supabase, organizationId),
    getQuotesSummary(supabase, organizationId, userId),
  ]);

  return Response.json({ projects, finance, clients, tasks, team, quotes });
}
