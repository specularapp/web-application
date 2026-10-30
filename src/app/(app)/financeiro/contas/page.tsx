import { cookies } from "next/headers";
import { AccountsScreen } from "@/features/finance/components/accounts-screen";
import { financeViews, parseFinanceView } from "@/features/finance/list";
import { loadAccountsScreenData } from "@/features/finance/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Contas bancárias",
  description: "Os bancos, as maquininhas e o caixa, com o saldo e o extrato de cada um",
  path: "/financeiro/contas",
});

export default async function AccountsPage() {
  const [data, cookieStore] = await Promise.all([loadAccountsScreenData(), cookies()]);
  return <AccountsScreen {...data} view={parseFinanceView("contas", cookieStore.get(financeViews.contas.cookie)?.value)} />;
}
