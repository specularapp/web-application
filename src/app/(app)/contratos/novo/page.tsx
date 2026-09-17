import { cookies } from "next/headers";
import { getAiUsageData } from "@/features/ai/queries";
import { ContractsScreen } from "@/features/contracts/components/contracts-screen";
import { CONTRACTS_GRID_COOKIE, parseContractsGridSize, parseContractsQuery } from "@/features/contracts/list";
import { getContractsPage } from "@/features/contracts/queries";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Novo contrato",
  description: "Gere um contrato a partir de um PDF, de um modelo pronto ou do zero",
  path: "/contratos/novo",
  noIndex: true,
});

// A mesma tela da lista, com a janela de escolher a origem já aberta: a criação tem endereço próprio, e abrir
// pela lista só troca a URL, sem sair da tela. Mesmo contrato de `/projetos/novo`.
export default async function NewContractPage({ searchParams }: PageProps<"/contratos/novo">) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
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

  /* `?cliente=` chega do leque da ficha do cliente: o rascunho nasce já ligado a ele, pelas três origens. */
  const prefill = { clientId: first(params.cliente) || undefined };

  return <ContractsScreen page={page} query={query} ai={ai} creating prefill={prefill} />;
}
