import { cookies } from "next/headers";
import { getAiUsageData } from "@/features/ai/queries";
import { ContractsScreen } from "@/features/contracts/components/contracts-screen";
import { CONTRACTS_GRID_COOKIE, parseContractsGridSize, parseContractsQuery } from "@/features/contracts/list";
import { getContractsPage } from "@/features/contracts/queries";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Contratos",
  description: "Gere e acompanhe contratos a partir dos orçamentos aprovados",
  path: "/contratos",
});

export default async function ContractsPage({ searchParams }: PageProps<"/contratos">) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  // Quantos por página, quando a URL não diz, é o que a grade mediu e guardou no cookie na última visita.
  const gridSize = parseContractsGridSize(cookieStore.get(CONTRACTS_GRID_COOKIE)?.value);
  const query = parseContractsQuery(
    {
      busca: first(params.busca),
      situacao: first(params.situacao),
      origem: first(params.origem),
      tipo: first(params.tipo),
      pagina: first(params.pagina),
      porPagina: first(params.porPagina),
    },
    gridSize,
  );

  const [page, ai] = await Promise.all([getContractsPage(query), getAiUsageData()]);

  return <ContractsScreen page={page} query={query} ai={ai} />;
}
