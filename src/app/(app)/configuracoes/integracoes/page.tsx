import { getAiUsageData } from "@/features/ai/queries";
import { IntegrationsSettings } from "@/features/settings/components/integrations-settings";
import { getIntegrationsSettings } from "@/features/settings/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Integrações",
  description: "O que está ligado à casa e por onde quem automatiza entra",
  path: "/configuracoes/integracoes",
  noIndex: true,
});

export default async function IntegrationsPage() {
  const [data, ai] = await Promise.all([getIntegrationsSettings(), getAiUsageData()]);
  return <IntegrationsSettings integrations={data} ai={ai} />;
}
