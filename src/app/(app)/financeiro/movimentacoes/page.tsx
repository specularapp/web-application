import { cookies } from "next/headers";
import { MovementsScreen } from "@/features/finance/components/accounts-screen";
import { financeViews, parseFinanceView } from "@/features/finance/list";
import { loadMovementsScreenData } from "@/features/finance/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Movimentações",
  description: "Todo dinheiro que entrou ou saiu da empresa, com o recibo de cada um",
  path: "/financeiro/movimentacoes",
});

export default async function MovementsPage() {
  const [data, cookieStore] = await Promise.all([loadMovementsScreenData(), cookies()]);
  return <MovementsScreen {...data} view={parseFinanceView("movimentacoes", cookieStore.get(financeViews.movimentacoes.cookie)?.value)} />;
}
