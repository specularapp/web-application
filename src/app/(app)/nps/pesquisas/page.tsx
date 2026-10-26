import { getAiUsageData } from "@/features/ai/queries";
import { NpsScreen } from "@/features/nps/components/nps-screen";
import { SurveysBoard } from "@/features/nps/components/surveys-board";
import { npsSample } from "@/features/nps/sample";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Pesquisas de NPS",
  description: "As pesquisas de satisfação enviadas aos clientes depois das entregas",
  path: "/nps/pesquisas",
  noIndex: true,
});

export default async function NpsSurveysPage() {
  const ai = await getAiUsageData();
  return (
    <NpsScreen title="Pesquisas de NPS" ai={ai}>
      <SurveysBoard data={npsSample()} />
    </NpsScreen>
  );
}
