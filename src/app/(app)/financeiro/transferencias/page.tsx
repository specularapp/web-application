import { TransfersScreen } from "@/features/finance/components/accounts-screen";
import { loadTransfersScreenData } from "@/features/finance/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Transferências",
  description: "O dinheiro que mudou de conta, de onde saiu e para onde foi",
  path: "/financeiro/transferencias",
});

export default async function TransfersPage() {
  const data = await loadTransfersScreenData();
  return <TransfersScreen {...data} />;
}
