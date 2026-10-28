import { InstallmentsScreen } from "@/features/finance/components/accounts-screen";
import { loadInstallmentsScreenData } from "@/features/finance/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Contas a pagar",
  description: "As parcelas das despesas, pelo vencimento, até serem pagas",
  path: "/financeiro/a-pagar",
});

export default async function PayablesPage() {
  const data = await loadInstallmentsScreenData("outgoing");
  return <InstallmentsScreen {...data} />;
}
