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
  const data = await getSecuritySettings();
  return <SecuritySettings {...data} />;
}
