import { InstallmentsScreen } from "@/features/finance/components/accounts-screen";
import { loadInstallmentsScreenData } from "@/features/finance/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Contas a receber",
  description: "As parcelas das cobranças, pelo vencimento, até serem recebidas",
  path: "/financeiro/a-receber",
});

export default async function ReceivablesPage() {
  const data = await loadInstallmentsScreenData("incoming");
  return <InstallmentsScreen {...data} />;
}
