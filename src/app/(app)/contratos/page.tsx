import { cookies } from "next/headers";
import { previewAiUsage } from "@/features/ai/preview";
import { ContractsScreen } from "@/features/contracts/components/contracts-screen";
import { CONTRACTS_GRID_COOKIE, listContracts, parseContractsGridSize, parseContractsQuery } from "@/features/contracts/list";
import { readContracts } from "@/features/contracts/store";
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

  // A lista vem do store em memória enquanto o domínio não existe no banco: quando a tabela nascer, muda só
  // esta linha, porque quem filtra, ordena e corta a página é `listContracts`, que recebe a lista de fora.
  // O uso da IA vem de `features/ai/preview.ts` pelo mesmo motivo, no contrato das outras telas.
  return <ContractsScreen page={listContracts(await readContracts(), query)} query={query} ai={previewAiUsage} />;
}
