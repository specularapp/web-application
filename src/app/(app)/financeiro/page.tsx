import { getAiUsageData } from "@/features/ai/queries";
import { FinanceScreen } from "@/features/finance/components/finance-screen";
import { getFinanceOverviewData } from "@/features/finance/queries";
import { financePeriodSchema } from "@/features/finance/schemas";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Financeiro",
  description: "O caixa, o que entrou e saiu, o que está por receber e as movimentações",
  path: "/financeiro",
});

export default async function FinancePage({ searchParams }: PageProps<"/financeiro">) {
  const params = await searchParams;
  const period = financePeriodSchema.parse(first(params.periodo));

  const [overview, ai] = await Promise.all([getFinanceOverviewData(period), getAiUsageData()]);

  return <FinanceScreen overview={overview} ai={ai} />;
}
