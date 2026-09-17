import { cookies } from "next/headers";
import { getAiUsageData } from "@/features/ai/queries";
import { ChargesScreen } from "@/features/finance/components/charges-screen";
import {
  CHARGES_GRID_COOKIE,
  CHARGES_VIEW_COOKIE,
  defaultChargesPageSize,
  listCharges,
  parseChargesGridSize,
  parseChargesQuery,
  parseChargesView,
} from "@/features/finance/list";
import { loadChargesScreenData } from "@/features/finance/queries";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Cobranças",
  description: "As cobranças aos clientes, as parcelas, o que venceu e o que já entrou",
  path: "/cobrancas",
});

export default async function ChargesPage({ searchParams }: PageProps<"/cobrancas">) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const view = parseChargesView(cookieStore.get(CHARGES_VIEW_COOKIE)?.value);
  const gridSize = parseChargesGridSize(cookieStore.get(CHARGES_GRID_COOKIE)?.value);
  const query = parseChargesQuery(
    {
      busca: first(params.busca),
      situacao: first(params.situacao),
      forma: first(params.forma),
      pagina: first(params.pagina),
      porPagina: first(params.porPagina),
    },
    defaultChargesPageSize(view, gridSize),
  );

  const [data, ai] = await Promise.all([loadChargesScreenData(), getAiUsageData()]);

  return <ChargesScreen page={listCharges(data.charges, query)} query={query} view={view} lookups={data.lookups} ai={ai} />;
}
