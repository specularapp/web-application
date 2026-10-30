import { cookies } from "next/headers";
import { InstallmentsScreen } from "@/features/finance/components/accounts-screen";
import { financeViews, parseFinanceView } from "@/features/finance/list";
import { loadInstallmentsScreenData } from "@/features/finance/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Contas a pagar",
  description: "As parcelas das despesas, pelo vencimento, até serem pagas",
  path: "/financeiro/a-pagar",
});

export default async function PayablesPage() {
  const [data, cookieStore] = await Promise.all([loadInstallmentsScreenData("outgoing"), cookies()]);
  return <InstallmentsScreen {...data} view={parseFinanceView("pagar", cookieStore.get(financeViews.pagar.cookie)?.value)} />;
}
