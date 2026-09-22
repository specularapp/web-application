import { cookies } from "next/headers";
import { getAiUsageData } from "@/features/ai/queries";
import { CrmScreen } from "@/features/crm/components/crm-screen";
import { CRM_STAGES_COOKIE, buildCrmBoard, parseCrmQuery, parseCrmStageOverrides } from "@/features/crm/list";
import { loadCrmScreenData } from "@/features/crm/queries";
import { crmStagesInUse } from "@/features/crm/tree";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Funil de vendas",
  description: "Acompanhe cada oportunidade do primeiro contato ao fechamento",
  path: "/crm",
});

export default async function CrmPage({ searchParams }: PageProps<"/crm">) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const collapsed = parseCrmStageOverrides(cookieStore.get(CRM_STAGES_COOKIE)?.value);
  const query = parseCrmQuery({
    busca: first(params.busca),
    temperatura: first(params.temperatura),
    previsao: first(params.previsao),
    paradas: first(params.paradas),
  });

  const [data, ai] = await Promise.all([loadCrmScreenData(query), getAiUsageData()]);

  // As colunas são as **etapas em uso**, e não uma lista fixa: este quadro cruza funis com caminhos
  // diferentes, e cada funil tem as etapas dele.
  const board = buildCrmBoard(data.opportunities, query, crmStagesInUse(data.opportunities, data.funnels));

  return <CrmScreen board={board} query={query} collapsed={collapsed} ai={ai} basePath="/crm" team={data.team} clients={data.clients} funnels={data.funnels} />;
}
