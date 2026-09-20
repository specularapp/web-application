import "server-only";
import { headers } from "next/headers";
import type { PortfolioProject } from "@/features/portfolio/service";
import type { ResumeLink } from "@/features/settings/schemas";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";

/** O currículo como a página pública o desenha: a pessoa, o que ela escreveu e os projetos públicos dela. */
export type PublicResume = {
  name: string | null;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  skills: string[];
  links: ResumeLink[];
  team: { name: string; slug: string; logoUrl: string | null; website: string | null } | null;
  projects: PortfolioProject[];
};

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * A leitura pública do currículo, a que `/cv/<slug>` usa: pela chave secreta, com teto por origem, e só
 * quando a pessoa ligou o currículo público.
 */
export async function loadPublicResume(slug: string): Promise<PublicResume | null> {
  const value = slug.trim().toLowerCase();
  if (!SLUG.test(value) || value.length > 40) return null;

  const ip = clientIp(await headers());
  const { allowed } = await checkRateLimit("publicLink", `resume:${ip}`, crypto.randomUUID());
  if (!allowed) return null;

  const { data } = await createAdminClient().rpc("public_resume", { p_slug: value });
  if (!data || typeof data !== "object") return null;
  return data as unknown as PublicResume;
}
