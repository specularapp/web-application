import { notFound } from "next/navigation";
import { getAiUsageData } from "@/features/ai/queries";
import { AccountSettings } from "@/features/settings/components/account-settings";
import { getAccountSettings } from "@/features/settings/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Sua conta",
  description: "Quem você é para a equipe e a equipe em que você está",
  path: "/configuracoes",
  noIndex: true,
});

// A ficha da pessoa (2026-09-17; refeita em 2026-09-20 só sobre ela, sem a equipe). Server Component: lê e
// entrega; quem tem estado é a tela.
export default async function AccountPage() {
  const [data, ai] = await Promise.all([getAccountSettings(), getAiUsageData()]);
  if (!data) notFound();

  return <AccountSettings {...data} ai={ai} />;
}
