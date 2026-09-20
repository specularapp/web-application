import { getAiUsageData } from "@/features/ai/queries";
import { PlanSettings } from "@/features/billing/components/plan-settings";
import { getCurrentBillingPage } from "@/features/billing/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Plano e assinatura",
  description: "Seu plano, pagamento e faturas da Specular",
  path: "/configuracoes/plano",
  noIndex: true,
});

export default async function PlanPage() {
  const [data, ai] = await Promise.all([getCurrentBillingPage(), getAiUsageData()]);
  if (!data) return null;

  return <PlanSettings state={data.state} invoices={data.invoices} ai={ai} />;
}
