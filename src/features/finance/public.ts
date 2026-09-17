import "server-only";
import { headers } from "next/headers";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import { isShareToken } from "@/lib/security/share-token";
import { createAdminClient } from "@/lib/supabase/server";
import { getChargeByToken, markChargeViewed } from "./service";

/**
 * A leitura pública de uma cobrança: sem sessão, com o token como única credencial, pela chave secreta e
 * com teto por endereço de origem.
 */
export async function loadPublicCharge(token: string) {
  if (!isShareToken(token)) return null;

  const ip = clientIp(await headers());
  const { allowed } = await checkRateLimit("publicLink", `charge:${ip}`, crypto.randomUUID());
  if (!allowed) return null;

  return getChargeByToken(createAdminClient(), token);
}

export async function markPublicChargeViewed(token: string) {
  if (!isShareToken(token)) return;
  await markChargeViewed(createAdminClient(), token);
}
