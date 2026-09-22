import { cookies } from "next/headers";
import { getAiUsageData } from "@/features/ai/queries";
import { ChargesScreen } from "@/features/finance/components/charges-screen";
import { CHARGES_GRID_COOKIE, CHARGES_VIEW_COOKIE, defaultChargesPageSize, listCharges, parseChargesGridSize, parseChargesQuery, parseChargesView } from "@/features/finance/list";
import { loadChargesScreenData } from "@/features/finance/queries";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({ title: "Nova despesa", description: "Registre uma conta a pagar", path: "/despesas/nova", noIndex: true });

export default async function NewExpensePage({ searchParams }: PageProps<"/despesas/nova">) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const view = parseChargesView(cookieStore.get(CHARGES_VIEW_COOKIE)?.value);
  const gridSize = parseChargesGridSize(cookieStore.get(CHARGES_GRID_COOKIE)?.value);
  const query = parseChargesQuery({ busca: first(params.busca), situacao: first(params.situacao), forma: first(params.forma), pagina: first(params.pagina), porPagina: first(params.porPagina) }, defaultChargesPageSize(view, gridSize));
  query.direction = "outgoing";
  const [data, ai] = await Promise.all([loadChargesScreenData("/despesas"), getAiUsageData()]);
  const prefill = { clientId: first(params.fornecedor) || undefined };

  return <ChargesScreen page={listCharges(data.charges, query)} query={query} view={view} lookups={data.lookups} ai={ai} direction="outgoing" creating prefill={prefill} />;
}
