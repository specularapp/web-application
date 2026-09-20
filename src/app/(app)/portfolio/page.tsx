import { notFound } from "next/navigation";
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
  const data = await getPortfolioPage();
  if (!data) notFound();

  return <PortfolioSettings {...data} />;
}
