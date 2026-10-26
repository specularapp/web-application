import { getAiUsageData } from "@/features/ai/queries";
import { NpsScreen } from "@/features/nps/components/nps-screen";
import { TreatmentsBoard } from "@/features/nps/components/treatments-board";
import { npsSample } from "@/features/nps/sample";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Tratativas do NPS",
  description: "A fila de contato com os clientes que deram nota baixa, do primeiro contato à recuperação",
  path: "/nps/tratativas",
  noIndex: true,
});

export default async function NpsTreatmentsPage() {
  const ai = await getAiUsageData();
  return (
    <NpsScreen title="Tratativas do NPS" ai={ai}>
      <TreatmentsBoard data={npsSample()} />
    </NpsScreen>
  );
}
