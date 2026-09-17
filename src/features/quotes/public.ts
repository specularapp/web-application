import "server-only";
import { headers } from "next/headers";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import { isShareToken } from "@/lib/security/share-token";
import { createAdminClient } from "@/lib/supabase/server";
import { getQuoteByToken, markQuoteViewed } from "./service";

/**
 * A leitura pública de um orçamento, a que a página do cliente e a rota do PDF usam. Fica num arquivo
 * próprio porque o caminho é outro: não há sessão, a credencial é só o token, a consulta passa pela chave
 * secreta e o teto de requisições é por endereço de origem, para o link não virar porta de varredura.
 */
export async function loadPublicQuote(token: string) {
  if (!isShareToken(token)) return null;

  const ip = clientIp(await headers());
  const { allowed } = await checkRateLimit("publicLink", `quote:${ip}`, crypto.randomUUID());
  if (!allowed) return null;

  return getQuoteByToken(createAdminClient(), token);
}

/** Registrar que o cliente abriu: a única escrita que a página pública faz, e ela é de mão única. */
export async function markPublicQuoteViewed(token: string) {
  if (!isShareToken(token)) return;
  await markQuoteViewed(createAdminClient(), token);
}
