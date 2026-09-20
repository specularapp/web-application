import { notFound } from "next/navigation";
import { getAiUsageData } from "@/features/ai/queries";
import { PortfolioSettings } from "@/features/portfolio/components/portfolio-settings";
import { getPortfolioPage } from "@/features/portfolio/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Portfólio",
  description: "A vitrine pública dos seus projetos e o que entra nela",
  path: "/portfolio",
  noIndex: true,
});

export default async function PortfolioPage() {
  const [data, ai] = await Promise.all([getPortfolioPage(), getAiUsageData()]);
  if (!data) notFound();

  return <PortfolioSettings {...data} ai={ai} />;
}
