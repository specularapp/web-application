import { getAiUsageData } from "@/features/ai/queries";
import { FeedbacksScreen } from "@/features/feedbacks/components/feedbacks-screen";
import { getFeedbacksScreenData } from "@/features/feedbacks/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({ title: "Feedbacks", description: "Avaliações curtas recebidas após a entrega dos projetos", path: "/feedbacks" });

export default async function FeedbacksPage() {
  const [data, ai] = await Promise.all([getFeedbacksScreenData(), getAiUsageData()]);
  return <FeedbacksScreen {...data} ai={ai} />;
}
