import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { API_KEY_PREFIX } from "./catalog";

/**
 * As credenciais das integrações (2026-10-29).
 *
 * A chave de API é aleatória e só existe inteira no instante em que nasce: o banco guarda o `sha256` dela, por onde
 * a porta de entrada a acha, e o começo, para a lista mostrar qual é qual. Perdeu, renova.
 *
 * O segredo de assinatura do webhook precisa ser lido de novo a cada entrega, então não dá para guardar só o
 * resumo. Ele também não é guardado: sai do segredo da casa, do id do webhook e da versão, como os tokens dos
 * links públicos (`lib/security/share-token.ts`). Um vazamento do banco não assina nada, e girar é somar um na
 * versão.
 */

const API_KEY_PATTERN = new RegExp(`^${API_KEY_PREFIX}[A-Za-z0-9_-]{43}$`);

export function apiKeyHash(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function newApiKey() {
  const secret = `${API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { secret, prefix: secret.slice(0, API_KEY_PREFIX.length + 4), hash: apiKeyHash(secret) };
}

/** O que chegou no `Authorization` tem a forma de uma chave da casa, e não de um token de sessão. */
export function looksLikeApiKey(token: string) {
  return token.startsWith(API_KEY_PREFIX);
}

export function isApiKey(token: string) {
  return API_KEY_PATTERN.test(token);
}

/** O segredo no formato do padrão Standard Webhooks: `whsec_` e 32 bytes em base64. */
export function webhookSecret(id: string, version: number) {
  const bytes = createHmac("sha256", env.share().SHARE_LINK_SECRET).update(`webhook:${id}:${version}`).digest();
  return `whsec_${bytes.toString("base64")}`;
}

/** `v1,<base64 do HMAC-SHA256 de "id.timestamp.corpo">`, com a chave sendo os bytes depois de `whsec_`. */
export function signWebhook(secret: string, messageId: string, timestamp: string, body: string) {
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  return `v1,${createHmac("sha256", key).update(`${messageId}.${timestamp}.${body}`).digest("base64")}`;
}

/** A conferência de quem recebe, aqui para a documentação e o teste dizerem a mesma coisa que o envio faz. */
export function verifyWebhookSignature(secret: string, messageId: string, timestamp: string, body: string, header: string) {
  const expected = Buffer.from(signWebhook(secret, messageId, timestamp, body).slice(3), "base64");
  return header.split(" ").some((signature) => {
    if (!signature.startsWith("v1,")) return false;
    const received = Buffer.from(signature.slice(3), "base64");
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}
