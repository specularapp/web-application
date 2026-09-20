import { getAiUsageData } from "@/features/ai/queries";
import { SecuritySettings } from "@/features/settings/components/security-settings";
import { getSecuritySettings } from "@/features/settings/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Segurança",
  description: "Senha, verificação em duas etapas e como você entra",
  path: "/configuracoes/seguranca",
  noIndex: true,
});

export default async function SecurityPage() {
  const [data, ai] = await Promise.all([getSecuritySettings(), getAiUsageData()]);
  return <SecuritySettings {...data} ai={ai} />;
}
