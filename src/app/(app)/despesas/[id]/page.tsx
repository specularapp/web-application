import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getAiUsageData } from "@/features/ai/queries";
import { ChargesScreen } from "@/features/finance/components/charges-screen";
import { CHARGES_GRID_COOKIE, CHARGES_VIEW_COOKIE, defaultChargesPageSize, listCharges, parseChargesGridSize, parseChargesQuery, parseChargesView } from "@/features/finance/list";
import { getChargeById, loadChargesScreenData } from "@/features/finance/queries";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export async function generateMetadata({ params }: PageProps<"/despesas/[id]">) {
  const { id } = await params;
  const expense = await getChargeById(id, "/despesas");
  return createMetadata({ title: expense ? `${expense.reference}: ${expense.title}` : "Despesa", description: "Ficha da despesa, parcelas e pagamentos", path: `/despesas/${id}`, noIndex: true });
}

export default async function ExpensePage({ params, searchParams }: PageProps<"/despesas/[id]">) {
  const [{ id }, search, cookieStore] = await Promise.all([params, searchParams, cookies()]);
  const view = parseChargesView(cookieStore.get(CHARGES_VIEW_COOKIE)?.value);
  const gridSize = parseChargesGridSize(cookieStore.get(CHARGES_GRID_COOKIE)?.value);
  const query = parseChargesQuery({ busca: first(search.busca), situacao: first(search.situacao), forma: first(search.forma), pagina: first(search.pagina), porPagina: first(search.porPagina) }, defaultChargesPageSize(view, gridSize));
  query.direction = "outgoing";
  const [expense, data, ai] = await Promise.all([getChargeById(id, "/despesas"), loadChargesScreenData("/despesas"), getAiUsageData()]);
  if (!expense || expense.direction !== "outgoing") notFound();

  return <ChargesScreen page={listCharges(data.charges, query)} query={query} view={view} lookups={data.lookups} ai={ai} direction="outgoing" viewing={expense} />;
}
