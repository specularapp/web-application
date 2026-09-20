import { notFound } from "next/navigation";
import { AccountSettings } from "@/features/settings/components/account-settings";
import { getAccountSettings } from "@/features/settings/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Sua conta",
  description: "Quem você é para a equipe e a equipe em que você está",
  path: "/configuracoes",
  noIndex: true,
});

// A conta de quem entra e a equipe em que está (2026-09-17). Server Component: lê e entrega; quem tem estado
// é a tela.
export default async function AccountPage() {
  const data = await getAccountSettings();
  if (!data) notFound();

  return <AccountSettings account={data.account} team={data.team} viewer={data.viewer} />;
}
