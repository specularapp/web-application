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
  const data = await getIntegrationsSettings();
  return <IntegrationsSettings {...data} />;
}
