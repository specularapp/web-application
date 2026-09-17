import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getAiUsageData } from "@/features/ai/queries";
import { ContractsScreen } from "@/features/contracts/components/contracts-screen";
import { CONTRACTS_GRID_COOKIE, parseContractsGridSize, parseContractsQuery } from "@/features/contracts/list";
import { getContractById, getContractsPage } from "@/features/contracts/queries";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

/** O nome do contrato no título da aba: é a ficha dele que a página abre, e não "Contratos" outra vez. */
export async function generateMetadata({ params }: PageProps<"/contratos/[id]">) {
  const { id } = await params;
  const contract = await getContractById(id);

  return createMetadata({
    title: contract ? contract.title : "Contrato",
    description: "Ficha do contrato, com o documento, as partes e a linha do tempo da assinatura",
    path: `/contratos/${id}`,
    noIndex: true,
  });
}

// A mesma tela da lista, com a janela do contrato já aberta no do endereço: assim a ficha pode ser
// compartilhada e aberta direto, e pela lista abrir só troca a URL, sem sair da tela.
export default async function ContractPage({ params, searchParams }: PageProps<"/contratos/[id]">) {
  const [{ id }, search, cookieStore] = await Promise.all([params, searchParams, cookies()]);

  const gridSize = parseContractsGridSize(cookieStore.get(CONTRACTS_GRID_COOKIE)?.value);
  const query = parseContractsQuery(
    {
      busca: first(search.busca),
      situacao: first(search.situacao),
      origem: first(search.origem),
      tipo: first(search.tipo),
      pagina: first(search.pagina),
      porPagina: first(search.porPagina),
    },
    gridSize,
  );

  const [contract, page, ai] = await Promise.all([getContractById(id), getContractsPage(query), getAiUsageData()]);
  if (!contract) notFound();

  return <ContractsScreen page={page} query={query} ai={ai} viewing={contract} />;
}
