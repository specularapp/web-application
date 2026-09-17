import "server-only";
import { headers } from "next/headers";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import { isShareToken } from "@/lib/security/share-token";
import { createAdminClient } from "@/lib/supabase/server";
import { getContractByPartyToken, markContractViewed, readContractFile } from "./service";

/**
 * A leitura pública de um contrato pela credencial **da parte**, e não do contrato: um convite não assina
 * pelo outro. Sem sessão, pela chave secreta, com teto por endereço de origem.
 */
export async function loadPublicContract(token: string) {
  if (!isShareToken(token)) return null;

  const ip = clientIp(await headers());
  const { allowed } = await checkRateLimit("publicLink", `contract:${ip}`, crypto.randomUUID());
  if (!allowed) return null;

  return getContractByPartyToken(createAdminClient(), token);
}

export async function markPublicContractViewed(token: string) {
  if (!isShareToken(token)) return;
  await markContractViewed(createAdminClient(), token);
}

/** Os bytes do PDF anexado pela mesma credencial da página: quem tem o token tem o documento. */
export async function readPublicContractFile(organizationId: string, contractId: string) {
  return readContractFile(createAdminClient(), organizationId, contractId);
}
