import { cookies } from "next/headers";
import { InstallmentsScreen } from "@/features/finance/components/accounts-screen";
import { financeViews, parseFinanceView } from "@/features/finance/list";
import { loadInstallmentsScreenData } from "@/features/finance/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Contas a receber",
  description: "As parcelas das cobranças, pelo vencimento, até serem recebidas",
  path: "/financeiro/a-receber",
});

export default async function ReceivablesPage() {
  const [data, cookieStore] = await Promise.all([loadInstallmentsScreenData("incoming"), cookies()]);
  return <InstallmentsScreen {...data} view={parseFinanceView("receber", cookieStore.get(financeViews.receber.cookie)?.value)} />;
}
