import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
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
import { getChargeById, loadChargesScreenData } from "@/features/finance/queries";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

/* Memorizada por requisição, na receita de `getOrganizationContext`: os metadados e a página pedem a mesma
   cobrança na mesma renderização, e sem isto a segunda chamada refazia a busca dos donos da equipe. */
const loadCharge = cache(getChargeById);

export async function generateMetadata({ params }: PageProps<"/cobrancas/[id]">) {
  const { id } = await params;
  const charge = await loadCharge(id);

  return createMetadata({
    title: charge ? `${charge.reference}: ${charge.title}` : "Cobrança",
    description: "A ficha da cobrança, com as parcelas, o que entrou e a linha do tempo",
    path: `/cobrancas/${id}`,
    noIndex: true,
  });
}

// A mesma tela da lista com a ficha já aberta: a cobrança tem endereço próprio, e abrir pela lista só troca a
// URL, sem sair da tela.
export default async function ChargePage({ params, searchParams }: PageProps<"/cobrancas/[id]">) {
  const [{ id }, search, cookieStore] = await Promise.all([params, searchParams, cookies()]);
  const view = parseChargesView(cookieStore.get(CHARGES_VIEW_COOKIE)?.value);
  const gridSize = parseChargesGridSize(cookieStore.get(CHARGES_GRID_COOKIE)?.value);
  const query = parseChargesQuery(
    {
      busca: first(search.busca),
      situacao: first(search.situacao),
      forma: first(search.forma),
      pagina: first(search.pagina),
      porPagina: first(search.porPagina),
    },
    defaultChargesPageSize(view, gridSize),
  );
  query.direction = "incoming";

  const [charge, data, ai] = await Promise.all([loadCharge(id), loadChargesScreenData(), getAiUsageData()]);
  if (!charge || charge.direction !== "incoming") notFound();

  return <ChargesScreen page={listCharges(data.charges, query)} query={query} view={view} lookups={data.lookups} ai={ai} direction="incoming" viewing={charge} />;
}
