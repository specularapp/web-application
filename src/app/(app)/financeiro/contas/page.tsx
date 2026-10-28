import { AccountsScreen } from "@/features/finance/components/accounts-screen";
import { loadAccountsScreenData } from "@/features/finance/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Contas bancárias",
  description: "Os bancos, as maquininhas e o caixa, com o saldo e o extrato de cada um",
  path: "/financeiro/contas",
});

export default async function AccountsPage() {
  const data = await loadAccountsScreenData();
  return <AccountsScreen {...data} />;
}
