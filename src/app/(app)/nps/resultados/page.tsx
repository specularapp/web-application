import { getAiUsageData } from "@/features/ai/queries";
import { NpsScreen } from "@/features/nps/components/nps-screen";
import { ResultsBoard } from "@/features/nps/components/results-board";
import { npsSample } from "@/features/nps/sample";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Resultados do NPS",
  description: "O NPS dos clientes, a evolução mês a mês, os aspectos avaliados e os assuntos dos comentários",
  path: "/nps/resultados",
  noIndex: true,
});

export default async function NpsResultsPage() {
  const ai = await getAiUsageData();
  return (
    <NpsScreen title="Resultados do NPS" ai={ai}>
      <ResultsBoard data={npsSample()} />
    </NpsScreen>
  );
}
