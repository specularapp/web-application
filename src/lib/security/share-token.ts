import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * A credencial dos endereços públicos: o link do orçamento, o de cada parte do contrato e o da cobrança.
 *
 * A regra de banco manda guardar token só como resumo, e a tela precisa poder mostrar o link de novo a
 * qualquer momento. As duas coisas só fecham se o token **não for guardado**: ele é derivado de um segredo
 * que existe apenas no servidor, mais o tipo do documento, o id da linha e a versão. O banco guarda o
 * `sha256` dele, que é por onde a busca acha a linha; um vazamento do banco, sozinho, não abre documento
 * nenhum, e o servidor recalcula o mesmo token sempre que alguém pede o link.
 *
 * Revogar é somar um na versão: o token anterior deixa de bater com o resumo gravado, sem apagar o
 * documento nem mexer em mais nada.
 */
export type ShareKind = "quote" | "contract" | "charge" | "project" | "form" | "feedback" | "approval";

function secret() {
  return env.share().SHARE_LINK_SECRET;
}

/** O token que vai na URL: hexadecimal, 256 bits, sem nada legível dentro. */
export function shareToken(kind: ShareKind, id: string, version = 1) {
  return createHmac("sha256", secret()).update(`${kind}:${id}:${version}`).digest("hex");
}

/** O resumo que o banco guarda e por onde a linha é achada. */
export function shareTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** O par pronto para gravar e para montar o endereço, numa chamada só. */
export function shareCredentials(kind: ShareKind, id: string, version = 1) {
  const token = shareToken(kind, id, version);
  return { token, hash: shareTokenHash(token) };
}

/**
 * Confere um token recebido da URL sem vazar quanto dele estava certo pelo tempo da comparação, e sem
 * derrubar quando o que chegou nem tem o formato de token.
 */
export function matchesShareToken(kind: ShareKind, id: string, version: number, token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) return false;
  const expected = Buffer.from(shareToken(kind, id, version), "hex");
  return timingSafeEqual(expected, Buffer.from(token, "hex"));
}

/** Token que chegou pela URL: só o formato, antes de qualquer ida ao banco. */
export function isShareToken(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}
