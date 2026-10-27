import { cookies } from "next/headers";
import { getAiUsageData } from "@/features/ai/queries";
import { ContractsScreen } from "@/features/contracts/components/contracts-screen";
import { CONTRACTS_VIEW_COOKIE, contractsQueryFrom, parseContractsView } from "@/features/contracts/list";
import { loadContractsScreenData } from "@/features/contracts/queries";
import { hasAi } from "@/lib/env";
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
  const view = parseContractsView(cookieStore.get(CONTRACTS_VIEW_COOKIE)?.value);
  const query = contractsQueryFrom(params, view);

  const [data, ai] = await Promise.all([loadContractsScreenData(query, "/contratos/novo"), getAiUsageData()]);

  /* `?cliente=` chega do leque da ficha do cliente: o rascunho nasce já ligado a ele, pelas três origens. */
  const prefill = { clientId: first(params.cliente) || undefined };

  return <ContractsScreen page={data.page} lookups={data.lookups} query={query} view={view} ai={ai} aiAvailable={hasAi()} creating prefill={prefill} />;
}
