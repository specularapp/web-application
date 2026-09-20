import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getAiUsageData } from "@/features/ai/queries";
import { CrmScreen } from "@/features/crm/components/crm-screen";
import { CRM_STAGES_COOKIE, buildCrmBoard, parseCrmQuery, parseCrmStageOverrides } from "@/features/crm/list";
import { getCrmTreeData, loadCrmScreenData } from "@/features/crm/queries";
import { findFunnel } from "@/features/crm/tree";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

/** O nome do funil no título da aba: é o quadro dele que a página abre, e não "Funil de vendas" outra vez. */
export async function generateMetadata({ params }: PageProps<"/crm/[funil]">) {
  const { funil } = await params;
  const funnel = findFunnel(await getCrmTreeData(), funil);

  return createMetadata({
    title: funnel ? funnel.name : "Funil",
    description: "Quadro de oportunidades do funil, com as etapas do caminho dele",
    path: `/crm/${funil}`,
    noIndex: true,
  });
}

// O quadro de um funil: a mesma tela de todas as oportunidades, com três diferenças que vêm da arquitetura —
// só as oportunidades dele, **as etapas que ele declara**, e o nome dele no topo.
export default async function CrmFunnelPage({ params, searchParams }: PageProps<"/crm/[funil]">) {
  const [{ funil }, search, cookieStore] = await Promise.all([params, searchParams, cookies()]);

  const collapsed = parseCrmStageOverrides(cookieStore.get(CRM_STAGES_COOKIE)?.value);
  const query = parseCrmQuery({
    busca: first(search.busca),
    temperatura: first(search.temperatura),
    previsao: first(search.previsao),
    paradas: first(search.paradas),
  });

  const [data, ai] = await Promise.all([loadCrmScreenData(query, funil), getAiUsageData()]);
  if (!data.funnel) notFound();

  const board = buildCrmBoard(data.opportunities, query, data.funnel.stages);

  return (
    <CrmScreen
      board={board}
      query={query}
      collapsed={collapsed}
      ai={ai}
      title={data.funnel.name}
      basePath={`/crm/${funil}`}
      team={data.team}
      funnelId={data.funnel.reference === null ? undefined : data.funnel.id}
    />
  );
}
