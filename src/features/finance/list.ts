import { z } from "zod";
import { payerOf } from "./labels";
import { GRID_PER_PAGE_DEFAULT, MAX_PER_PAGE, TABLE_PER_PAGE, defaultQuery, methodFilterValues, statusFilterValues, type ChargesListPage, type ChargesQuery } from "./list-options";
import { chargeOpen, chargeStatusOf, nextInstallment, todayIso, type Charge, type ChargeStatus } from "./summary";
import { DEFAULT_CHARGES_VIEW, chargesViewValues, type ChargesView } from "./view-cookie";

export { CHARGES_GRID_COOKIE, CHARGES_VIEW_COOKIE, type ChargesView } from "./view-cookie";

/**
 * A regra da listagem de cobranças: ler o que a URL e os cookies pedem, filtrar, ordenar e cortar a página.
 * Roda no servidor, porque parâmetro de URL é entrada de usuário e a lista virá do banco. Recebe as
 * cobranças de fora e não sabe de onde vêm.
 */

const querySchema = z.object({
  search: z.string().trim().max(80).catch(""),
  status: z.enum(statusFilterValues).catch(defaultQuery.status),
  method: z.enum(methodFilterValues).catch(defaultQuery.method),
  page: z.coerce.number().int().min(1).max(9999).catch(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PER_PAGE).optional().catch(undefined),
});

export function parseChargesView(raw: string | undefined): ChargesView {
  return z.enum(chargesViewValues).catch(DEFAULT_CHARGES_VIEW).parse(raw);
}

export function parseChargesGridSize(raw: string | undefined) {
  return z.coerce.number().int().min(2).max(MAX_PER_PAGE).multipleOf(2).catch(GRID_PER_PAGE_DEFAULT).parse(raw);
}

export function defaultChargesPageSize(view: ChargesView, gridSize: number) {
  return view === "tabela" ? TABLE_PER_PAGE : gridSize;
}

export function parseChargesQuery(params: Record<string, string | undefined>, fallbackPageSize = TABLE_PER_PAGE): ChargesQuery {
  const { pageSize, ...rest } = querySchema.parse({ search: params.busca, status: params.situacao, method: params.forma, page: params.pagina, pageSize: params.porPagina });
  return { ...rest, pageSize: pageSize ?? fallbackPageSize };
}

const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

/* Vencida primeiro, depois parcial e em aberto pelo vencimento mais perto, depois pagas e canceladas pelas
   mais recentes: é a ordem de quem cobra. */
const statusOrder: Record<ChargeStatus, number> = { overdue: 0, partial: 1, open: 2, paid: 3, cancelled: 4 };

export function listCharges(items: Charge[], query: ChargesQuery, today = todayIso()): ChargesListPage {
  const counts: Record<ChargeStatus, number> = { open: 0, partial: 0, overdue: 0, paid: 0, cancelled: 0 };
  const totals = { receivable: 0, overdue: 0 };
  const statuses = new Map<string, ChargeStatus>();
  items.forEach((charge) => {
    const status = chargeStatusOf(charge, today);
    statuses.set(charge.id, status);
    counts[status] += 1;
    totals.receivable += chargeOpen(charge);
    if (status === "overdue") totals.overdue += charge.installments.filter((installment) => !installment.paidAt && installment.dueDate < today).reduce((sum, installment) => sum + installment.amount, 0);
  });

  const needle = plain(query.search).trim();
  const filtered = items
    .filter((charge) => query.status === "todas" || statuses.get(charge.id) === query.status)
    .filter((charge) => query.method === "todas" || charge.method === query.method)
    .filter((charge) => !needle || needle.split(/\s+/).every((part) => plain([charge.title, charge.reference, payerOf(charge).name, payerOf(charge).company ?? "", charge.description].join(" ")).includes(part)))
    .sort((a, b) => {
      const order = statusOrder[statuses.get(a.id)!] - statusOrder[statuses.get(b.id)!];
      if (order !== 0) return order;
      const nextA = nextInstallment(a)?.dueDate ?? "";
      const nextB = nextInstallment(b)?.dueDate ?? "";
      return nextA && nextB ? nextA.localeCompare(nextB) : b.createdAt.localeCompare(a.createdAt);
    });

  const start = (query.page - 1) * query.pageSize;
  return { items: filtered.slice(start, start + query.pageSize), total: filtered.length, counts, totals };
}
