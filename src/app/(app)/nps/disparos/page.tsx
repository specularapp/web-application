import { getAiUsageData } from "@/features/ai/queries";
import { DispatchBoard } from "@/features/nps/components/dispatch-board";
import { NpsScreen } from "@/features/nps/components/nps-screen";
import { npsSample } from "@/features/nps/sample";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Disparos do NPS",
  description: "As regras que enviam a pesquisa sozinhas, os envios, a fila e as métricas do envio à resposta",
  path: "/nps/disparos",
  noIndex: true,
});

export default async function NpsDispatchPage() {
  const ai = await getAiUsageData();
  return (
    <NpsScreen title="Disparos do NPS" ai={ai}>
      <DispatchBoard data={npsSample()} />
    </NpsScreen>
  );
}
