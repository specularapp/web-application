import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortfolioPublic } from "@/features/portfolio/components/portfolio-public";
import { loadPublicPortfolio } from "@/features/portfolio/public";
import { createMetadata } from "@/lib/metadata";

type Params = { slug: string };

/** O que a rede social mostra ao desdobrar o link: o nome da equipe e quantos projetos há na vitrine. */
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const portfolio = await loadPublicPortfolio(slug);
  if (!portfolio) return createMetadata({ title: "Portfólio", description: "Este portfólio não está disponível.", noIndex: true });

  const count = portfolio.projects.length;
  return createMetadata({
    title: `${portfolio.team.name}: portfólio`,
    description: count > 0 ? `${count} ${count === 1 ? "projeto publicado" : "projetos publicados"} por ${portfolio.team.name}.` : `O portfólio de ${portfolio.team.name}.`,
    path: `/p/${slug}`,
    absoluteTitle: true,
  });
}

// A vitrine pública da equipe (2026-09-17): por slug da casa ou por domínio conferido. Vitrine que não existe
// cai no 404, como todo link público inválido.
export default async function PublicPortfolioPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const portfolio = await loadPublicPortfolio(slug);
  if (!portfolio) notFound();

  return <PortfolioPublic {...portfolio} />;
}
