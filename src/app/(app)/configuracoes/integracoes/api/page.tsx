import { getAiUsageData } from "@/features/ai/queries";
import { ApiSettings } from "@/features/integrations/components/api-settings";
import { getApiSettings } from "@/features/integrations/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "API",
  description: "As chaves de API da equipe, o registro de chamadas e como usar",
  path: "/configuracoes/integracoes/api",
  noIndex: true,
});

export default async function ApiPage() {
  const [data, ai] = await Promise.all([getApiSettings(), getAiUsageData()]);
  return <ApiSettings keys={data.keys} requests={data.requests} baseUrl={data.baseUrl} canManage={data.canManage} ai={ai} />;
}
