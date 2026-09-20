import "server-only";
import { cacheKey, cacheTtl, cached } from "@/lib/cache";
import { cacheTags } from "@/lib/cache/tags";
import { getOrganizationContext, requireOrganization } from "@/features/organizations/context";
import { getCharge, getChargeLookups, getFinanceOverview, getFinanceSummary, listCharges, type ChargeLookups } from "./service";
import type { Charge, FinanceOverview, FinancePeriod, FinanceSummary } from "./summary";

export type ChargesScreenData = { charges: Charge[]; lookups: ChargeLookups };

/**
 * O que a tela de cobranças precisa de uma vez: a lista e as bases da janela de nova cobrança.
 *
 * A lista vem inteira, e não paginada no banco, porque a situação de uma cobrança **não é gravada**: sai das
 * parcelas e da data de hoje, e é por ela que a tela filtra e ordena. Paginar no SQL cortaria a página antes
 * de saber o que é vencido. O teto do serviço segura o tamanho, e o cache segura a repetição.
 */
export async function loadChargesScreenData(next = "/cobrancas"): Promise<ChargesScreenData> {
  const { supabase, organizationId } = await requireOrganization(next);

  const [charges, lookups] = await Promise.all([
    cached(
      cacheKey(organizationId, "charges:list"),
      { organizationId, tags: [cacheTags.finance], ttl: cacheTtl.list },
      () => listCharges(supabase, organizationId),
    ),
    cached(
      cacheKey(organizationId, "charges:lookups"),
      { organizationId, tags: [cacheTags.finance, cacheTags.clients, cacheTags.quotes], ttl: cacheTtl.summary },
      () => getChargeLookups(supabase, organizationId),
    ),
  ]);

  return { charges, lookups };
}

export async function getChargeById(id: string, next = "/cobrancas"): Promise<Charge | null> {
  const { supabase, organizationId } = await requireOrganization(next);
  return getCharge(supabase, organizationId, id);
}

export async function getFinanceOverviewData(period: FinancePeriod, next = "/financeiro"): Promise<FinanceOverview> {
  const { supabase, organizationId } = await requireOrganization(next);

  return cached(
    cacheKey(organizationId, "finance:overview", period),
    { organizationId, tags: [cacheTags.finance], ttl: cacheTtl.summary },
    () => getFinanceOverview(supabase, organizationId, period),
  );
}

const EMPTY_BLOCK: FinanceSummary = { balance: 0, transactions: [] };

/* Como os demais blocos do painel: sem time o painel ainda abre, com a configuração inicial por cima. */
export async function getFinanceBlock(): Promise<FinanceSummary> {
  const context = await getOrganizationContext();
  if (!context) return EMPTY_BLOCK;
  const { supabase, organizationId } = context;

  return cached(
    cacheKey(organizationId, "finance:block"),
    { organizationId, tags: [cacheTags.finance], ttl: cacheTtl.summary },
    () => getFinanceSummary(supabase, organizationId),
  );
}
