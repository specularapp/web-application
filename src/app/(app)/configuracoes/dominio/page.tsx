import { notFound } from "next/navigation";
import { DomainSettings } from "@/features/settings/components/domain-settings";
import { getDomainSettings } from "@/features/settings/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Domínio",
  description: "O endereço do seu portfólio, na casa ou no seu domínio",
  path: "/configuracoes/dominio",
  noIndex: true,
});

export default async function DomainPage() {
  const data = await getDomainSettings();
  if (!data) notFound();

  return <DomainSettings domain={data.domain} />;
}
