import { FinanceScreen } from "@/features/finance/components/finance-screen";
import { loadCashFlowData } from "@/features/finance/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Fluxo de caixa",
  description: "O que entrou e saiu, o saldo projetado, o que está atrasado e o que vence",
  path: "/financeiro",
});

export default async function FinancePage() {
  const data = await loadCashFlowData();
  return <FinanceScreen {...data} />;
}
