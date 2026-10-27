import { cookies } from "next/headers";
import { getAiUsageData } from "@/features/ai/queries";
import { ContractsScreen } from "@/features/contracts/components/contracts-screen";
import { CONTRACTS_VIEW_COOKIE, contractsQueryFrom, parseContractsView } from "@/features/contracts/list";
import { loadContractsScreenData } from "@/features/contracts/queries";
import { hasAi } from "@/lib/env";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Contratos",
  description: "Gere e acompanhe contratos a partir dos orçamentos aprovados",
  path: "/contratos",
});

export default async function ContractsPage({ searchParams }: PageProps<"/contratos">) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  // A visão vem do cookie, e com ela a medida da página: trinta na tabela, cem no funil.
  const view = parseContractsView(cookieStore.get(CONTRACTS_VIEW_COOKIE)?.value);
  const query = contractsQueryFrom(params, view);

  const [data, ai] = await Promise.all([loadContractsScreenData(query), getAiUsageData()]);

  return <ContractsScreen page={data.page} lookups={data.lookups} query={query} view={view} ai={ai} aiAvailable={hasAi()} />;
}
