import { getAiUsageData } from "@/features/ai/queries";
import { ApprovalsScreen } from "@/features/approvals/components/approvals-screen";
import { getApprovalsScreenData } from "@/features/approvals/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({ title: "Aprovações", description: "Versões de sites, designs e entregas aguardando decisão do cliente", path: "/aprovacoes" });

export default async function ApprovalsPage() {
  const [data, ai] = await Promise.all([getApprovalsScreenData(), getAiUsageData()]);
  return <ApprovalsScreen {...data} ai={ai} />;
}
