import "server-only";
import { headers } from "next/headers";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { getPublicPortfolio, type Portfolio } from "./service";

/** O slug de equipe da casa, ou um nome de domínio: nada além disso chega à função do banco. */
const SLUG_OR_HOST = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;

/**
 * A leitura pública do portfólio, a que `/p/<slug>` usa. Sem sessão, a consulta passa pela chave secreta e o
 * teto de requisições é por endereço de origem, para o endereço não virar porta de varredura de slugs.
 */
export async function loadPublicPortfolio(slug: string): Promise<Portfolio | null> {
  const value = slug.trim().toLowerCase();
  if (!SLUG_OR_HOST.test(value) || value.length > 253) return null;

  const ip = clientIp(await headers());
  const { allowed } = await checkRateLimit("publicLink", `portfolio:${ip}`, crypto.randomUUID());
  if (!allowed) return null;

  return getPublicPortfolio(createAdminClient(), value);
}
