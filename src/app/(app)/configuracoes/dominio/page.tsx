import { notFound } from "next/navigation";
import { getAiUsageData } from "@/features/ai/queries";
import { DomainSettings } from "@/features/settings/components/domain-settings";
import { getDomainSettings } from "@/features/settings/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Domínios",
  description: "Os domínios próprios do portfólio, com o DNS de cada um",
  path: "/configuracoes/dominio",
  noIndex: true,
});

export default async function DomainPage() {
  const [data, ai] = await Promise.all([getDomainSettings(), getAiUsageData()]);
  if (!data) notFound();

  return <DomainSettings overview={data.overview} canManage={data.canManage} ai={ai} />;
}
