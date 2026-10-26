import { getAiUsageData } from "@/features/ai/queries";
import { NpsScreen } from "@/features/nps/components/nps-screen";
import { ResponsesInbox } from "@/features/nps/components/responses-inbox";
import { npsSample } from "@/features/nps/sample";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Respostas do NPS",
  description: "Cada resposta dos clientes, com o atendimento de quem deu nota baixa e a ficha da avaliação",
  path: "/nps/respostas",
  noIndex: true,
});

export default async function NpsResponsesPage({ searchParams }: PageProps<"/nps/respostas">) {
  const [params, ai] = await Promise.all([searchParams, getAiUsageData()]);
  return (
    <NpsScreen title="Respostas do NPS" ai={ai}>
      <ResponsesInbox data={npsSample()} initialId={first(params.id)} />
    </NpsScreen>
  );
}
