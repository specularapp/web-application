import { getAiUsageData } from "@/features/ai/queries";
import { WebhooksSettings } from "@/features/integrations/components/webhooks-settings";
import { getWebhooksSettings } from "@/features/integrations/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Webhooks",
  description: "Os endereços que recebem um aviso assinado quando algo acontece na casa",
  path: "/configuracoes/integracoes/webhooks",
  noIndex: true,
});

export default async function WebhooksPage() {
  const [data, ai] = await Promise.all([getWebhooksSettings(), getAiUsageData()]);
  return <WebhooksSettings webhooks={data.webhooks} canManage={data.canManage} ai={ai} />;
}
