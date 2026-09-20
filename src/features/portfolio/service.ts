import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectHue, ProjectStatus, ProjectTool } from "@/features/projects/summary";
import { siteConfig } from "@/lib/metadata";
import type { Database } from "@/types/database";

/**
 * O portfólio: a vitrine pública dos projetos que a equipe marcou como públicos. A leitura pública passa
 * pela função `public_portfolio` com a chave secreta, como toda leitura sem sessão da casa; a leitura interna
 * (a página que escolhe o que entra) é a lista de projetos da equipe com o interruptor de público.
 */
export type PortfolioClient = SupabaseClient<Database>;

/** Um projeto como a vitrine o mostra: só o que é público. Sem cliente, valor, prazo nem equipe. */
export type PortfolioProject = {
  id: string;
  name: string;
  description: string;
  url: string | null;
  coverUrl: string | null;
  logoUrl: string | null;
  tags: string[];
  tools: ProjectTool[];
  hue: ProjectHue;
  /** `yyyy-MM-dd`. */
  startedAt: string;
  status: ProjectStatus;
};

export type PortfolioTeam = {
  name: string;
  slug: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  website: string | null;
  industry: string | null;
};

export type Portfolio = { team: PortfolioTeam; projects: PortfolioProject[] };

/** A leitura pública, por slug da equipe ou por domínio conferido. Nulo quando não há vitrine nesse endereço. */
export async function getPublicPortfolio(admin: PortfolioClient, slug: string): Promise<Portfolio | null> {
  const { data } = await admin.rpc("public_portfolio", { p_slug: slug });
  if (!data || typeof data !== "object") return null;
  return data as unknown as Portfolio;
}

/** Um projeto na lista interna: o que a página de escolher mostra por linha. */
export type PortfolioPick = {
  id: string;
  name: string;
  description: string;
  coverUrl: string | null;
  logoUrl: string | null;
  hue: ProjectHue;
  status: ProjectStatus;
  isPublic: boolean;
  client: { name: string; company: string | null } | null;
};

export type PortfolioSettings = {
  publicUrl: string;
  slug: string;
  /** Quantos estão na vitrine. */
  shown: number;
  projects: PortfolioPick[];
};

/** A lista interna: todos os projetos da equipe, com o que já está público marcado, para ligar e desligar. */
export async function getPortfolioSettings(client: PortfolioClient, organizationId: string): Promise<PortfolioSettings | null> {
  const [{ data: team }, { data: projects }] = await Promise.all([
    client.from("organizations").select("slug").eq("id", organizationId).maybeSingle(),
    client
      .from("projects")
      .select("id, name, description, cover_url, logo_url, hue, status, is_public, clients(name, company)")
      .eq("organization_id", organizationId)
      .order("started_at", { ascending: false })
      .limit(200),
  ]);

  if (!team) return null;

  const picks: PortfolioPick[] = (projects ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    coverUrl: row.cover_url,
    logoUrl: row.logo_url,
    hue: row.hue as ProjectHue,
    status: row.status,
    isPublic: row.is_public,
    client: row.clients ? { name: row.clients.name, company: row.clients.company } : null,
  }));

  return {
    slug: team.slug,
    publicUrl: `${siteConfig.url}/p/${team.slug}`,
    shown: picks.filter((pick) => pick.isPublic).length,
    projects: picks,
  };
}
