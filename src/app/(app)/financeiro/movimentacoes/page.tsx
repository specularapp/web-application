import { MovementsScreen } from "@/features/finance/components/accounts-screen";
import { loadMovementsScreenData } from "@/features/finance/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Movimentações",
  description: "Todo dinheiro que entrou ou saiu da empresa, com o recibo de cada um",
  path: "/financeiro/movimentacoes",
});

export default async function MovementsPage() {
  const data = await loadMovementsScreenData();
  return <MovementsScreen {...data} />;
}
