import "server-only";
import { cache } from "react";
import { cacheKey, cacheTtl, cached } from "@/lib/cache";
import { cacheTags } from "@/lib/cache/tags";
import { getOrganizationContext, requireOrganization } from "@/features/organizations/context";
import { getCharge, getChargeLookups, getFinanceSummary, listCharges, type ChargeLookups } from "./service";
import type { AccountsScreenData, TransfersScreenData } from "./accounts";
import { financeToday, listAccountMovements, listFinanceAccounts, listTransfers } from "./accounts-service";
import type { InstallmentsScreenData } from "./installments";
import type { CashFlowData, MovementsScreenData } from "./movements";
import { listMovements } from "./movements-service";
import { listCategories, listInstallments } from "./installments-service";
import type { ChargeDirection } from "./summary";
import type { Charge, FinanceSummary } from "./summary";

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

/* Memorizada por requisição, na raiz e não em cada página: os metadados e a própria página pedem a mesma
   cobrança na mesma renderização, e sem isto a segunda chamada refazia a leitura inteira, incluindo a busca
   dos donos da equipe. A página de cobrança já memorizava por conta própria; a de despesa não, e era a mesma
   leitura duas vezes (2026-09-22, na varredura). A chave inclui o caminho de volta, então os dois domínios
   não se confundem. */
export const getChargeById = cache(
  async (id: string, next = "/cobrancas"): Promise<Charge | null> => {
    const { supabase, organizationId } = await requireOrganization(next);
    return getCharge(supabase, organizationId, id);
  },
);

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

/* As contas com os movimentos, que a tela de contas usa para a curva de cada cartão e para o extrato, e a de
   transferências para mostrar as duas pontas (2026-10-27). Uma leitura só por tela, no cache do financeiro. */
export async function loadAccountsScreenData(next = "/financeiro/contas"): Promise<AccountsScreenData> {
  const { supabase, organizationId } = await requireOrganization(next);

  return cached(
    cacheKey(organizationId, "finance:accounts"),
    { organizationId, tags: [cacheTags.finance], ttl: cacheTtl.list },
    async () => {
      const movements = await listAccountMovements(supabase, organizationId);
      const accounts = await listFinanceAccounts(supabase, organizationId, movements);
      return { accounts, movements, today: financeToday() };
    },
  );
}

export async function loadTransfersScreenData(next = "/financeiro/transferencias"): Promise<TransfersScreenData> {
  const { supabase, organizationId } = await requireOrganization(next);

  return cached(
    cacheKey(organizationId, "finance:transfers"),
    { organizationId, tags: [cacheTags.finance], ttl: cacheTtl.list },
    async () => {
      const movements = await listAccountMovements(supabase, organizationId);
      const [accounts, transfers] = await Promise.all([listFinanceAccounts(supabase, organizationId, movements), listTransfers(supabase, organizationId)]);
      return { accounts, transfers, today: financeToday() };
    },
  );
}

/* Contas a receber e a pagar (2026-10-27): as parcelas do lado, as contas para a janela de baixa e as categorias
   para o filtro. As contas vêm sem os movimentos, porque aqui só o saldo de agora importa. */
export async function loadInstallmentsScreenData(direction: ChargeDirection): Promise<InstallmentsScreenData> {
  const next = direction === "outgoing" ? "/financeiro/a-pagar" : "/financeiro/a-receber";
  const { supabase, organizationId } = await requireOrganization(next);

  return cached(
    cacheKey(organizationId, "finance:installments", direction),
    { organizationId, tags: [cacheTags.finance], ttl: cacheTtl.list },
    async () => {
      const [entries, accounts, categories] = await Promise.all([
        listInstallments(supabase, organizationId, direction),
        listFinanceAccounts(supabase, organizationId, []),
        listCategories(supabase, organizationId),
      ]);
      return { direction, entries, accounts, categories, today: financeToday() };
    },
  );
}

export async function loadMovementsScreenData(next = "/financeiro/movimentacoes"): Promise<MovementsScreenData> {
  const { supabase, organizationId } = await requireOrganization(next);

  return cached(
    cacheKey(organizationId, "finance:movements"),
    { organizationId, tags: [cacheTags.finance], ttl: cacheTtl.list },
    async () => {
      const [movements, accounts, categories] = await Promise.all([listMovements(supabase, organizationId), listFinanceAccounts(supabase, organizationId, []), listCategories(supabase, organizationId)]);
      return { movements, accounts, categories, today: financeToday() };
    },
  );
}

/* O fluxo de caixa (2026-10-27, fase 5 da vinda do financeiro da Le Ange): o que entrou e saiu, o que está por
   receber e por pagar dos dois lados, as contas e as categorias. As contas e o período são da tela, que faz as
   somas no navegador, como na Le Ange: trocar de período não volta ao servidor. */
export async function loadCashFlowData(next = "/financeiro"): Promise<CashFlowData> {
  const { supabase, organizationId } = await requireOrganization(next);

  return cached(
    cacheKey(organizationId, "finance:cash-flow"),
    { organizationId, tags: [cacheTags.finance], ttl: cacheTtl.summary },
    async () => {
      const [movements, receivables, payables, accounts, categories] = await Promise.all([
        listMovements(supabase, organizationId),
        listInstallments(supabase, organizationId, "incoming"),
        listInstallments(supabase, organizationId, "outgoing"),
        listFinanceAccounts(supabase, organizationId, []),
        listCategories(supabase, organizationId),
      ]);
      const pending = (entry: { status: string }) => entry.status === "open" || entry.status === "overdue";
      return {
        movements: movements.filter((entry) => entry.status === "confirmed"),
        dues: [...receivables.filter(pending), ...payables.filter(pending)],
        accounts,
        categories,
        today: financeToday(),
      };
    },
  );
}
