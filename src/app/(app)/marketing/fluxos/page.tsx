import { getAiUsageData } from "@/features/ai/queries";
import { FlowsScreen } from "@/features/marketing/components/flows-screen";
import { sampleEmailData, sampleFlows } from "@/features/marketing/sample";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Fluxos",
  description: "Fluxos de conversa automáticos no Instagram, no WhatsApp e no e-mail",
  path: "/marketing/fluxos",
  noIndex: true,
});

export default async function FlowsPage() {
  const ai = await getAiUsageData();

  return <FlowsScreen flows={sampleFlows} author={sampleEmailData.author} ai={ai} />;
}
