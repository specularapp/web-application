import "server-only";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

/*
 * Toda chamada que a casa faz a um endereço que a pessoa digitou passa por aqui (2026-10-29, trazido da Le Ange). O
 * endereço precisa ser https e público: sem isso, quem cadastra `https://localhost:5432` ou o IP de um serviço
 * interno faria o servidor bater na própria rede (SSRF). O nome é resolvido uma vez, todas as respostas são
 * conferidas e a conexão vai presa ao IP conferido, sem segunda consulta de DNS e sem seguir redirecionamento.
 */

const TIMEOUT_MS = 8000;
const DNS_TIMEOUT_MS = 2500;
const EXCERPT_BYTES = 500;

function isPrivateV4([a, b, c]: number[]) {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

export function isPrivateAddress(address: string) {
  const kind = isIP(address);
  if (kind === 4) return isPrivateV4(address.split(".").map(Number));
  if (kind !== 6) return true;
  const canonical = new URL(`http://[${address}]`).hostname.slice(1, -1);
  const [left, right] = canonical.split("::");
  const start = left ? left.split(":").map((part) => parseInt(part, 16)) : [];
  const end = right ? right.split(":").map((part) => parseInt(part, 16)) : [];
  const words = right === undefined ? start : [...start, ...Array<number>(8 - start.length - end.length).fill(0), ...end];
  if (words.slice(0, 5).every((part) => part === 0) && words[5] === 0xffff) {
    return isPrivateV4([words[6] >> 8, words[6] & 255, words[7] >> 8, words[7] & 255]);
  }
  // Só unicast global 2000::/3, sem as faixas de documentação e de transição.
  return (words[0] & 0xe000) !== 0x2000 || (words[0] === 0x2001 && (words[1] < 0x200 || words[1] === 0xdb8)) || words[0] === 0x2002;
}

/** O que há de errado na forma do endereço, ou nulo. Vale no formulário e antes de cada envio. */
export function urlProblem(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "O endereço não é válido. Use o endereço completo, começando por https://.";
  }
  if (url.protocol !== "https:") return "Só endereços https:// são aceitos.";
  if (url.username || url.password) return "O endereço não pode levar usuário e senha.";
  if (url.port && url.port !== "443") return "Use a porta padrão do https.";
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!host || host === "localhost" || /\.(localhost|local|internal)$/.test(host)) return "Esse endereço é interno da rede: use um endereço público.";
  if (isIP(host) && isPrivateAddress(host)) return "Esse endereço aponta para a rede interna: use um endereço público.";
  return null;
}

async function resolvePublic(host: string) {
  if (isIP(host)) return { address: host, family: isIP(host) };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    lookup(host, { all: true }).catch(() => []),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("O prazo de consulta do endereço foi excedido.")), DNS_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
  if (addresses.length === 0) throw new Error("Não encontrei esse endereço na internet. Confira se digitou certo.");
  if (addresses.some((entry) => isPrivateAddress(entry.address))) throw new Error("Esse endereço aponta para a rede interna: use um endereço público.");
  return addresses[0];
}

/** Confere no DNS que o endereço é público. Nulo quando está tudo certo, ou o recado. */
export async function publicUrlProblem(raw: string): Promise<string | null> {
  const problem = urlProblem(raw);
  if (problem) return problem;
  try {
    await resolvePublic(new URL(raw).hostname.replace(/^\[|\]$/g, ""));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Não foi possível conferir o endereço.";
  }
}

export type PostResult = { status: number | null; excerpt: string | null; durationMs: number; error: string | null };

/** Um POST com o corpo em JSON, preso ao IP conferido, com teto de tempo e só o começo da resposta guardado. */
export async function postJson(raw: string, headers: Record<string, string>, body: string): Promise<PostResult> {
  const began = performance.now();
  const elapsed = () => Math.round(performance.now() - began);
  const problem = urlProblem(raw);
  if (problem) return { status: null, excerpt: null, durationMs: 0, error: problem };

  try {
    const url = new URL(raw);
    const pinned = await resolvePublic(url.hostname.replace(/^\[|\]$/g, ""));
    const { status, excerpt } = await new Promise<{ status: number; excerpt: string }>((resolve, reject) => {
      const request = httpsRequest(
        url,
        {
          method: "POST",
          agent: false,
          family: pinned.family,
          lookup: (_host, _options, callback) => callback(null, pinned.address, pinned.family),
          headers: { ...headers, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body).toString() },
        },
        (response) => {
          const chunks: Buffer[] = [];
          let size = 0;
          response.on("data", (chunk: Buffer) => {
            if (size >= EXCERPT_BYTES) return;
            chunks.push(chunk);
            size += chunk.length;
            if (size >= EXCERPT_BYTES) response.destroy();
          });
          const finish = () => resolve({ status: response.statusCode ?? 0, excerpt: Buffer.concat(chunks).toString("utf8").slice(0, EXCERPT_BYTES) });
          response.on("end", finish);
          response.on("close", finish);
          response.on("error", finish);
        },
      );
      const timer = setTimeout(() => request.destroy(new Error("O destino não respondeu em 8 segundos.")), TIMEOUT_MS);
      request.on("close", () => clearTimeout(timer));
      request.on("error", reject);
      request.end(body);
    });
    const ok = status >= 200 && status < 300;
    return {
      status,
      excerpt: excerpt || null,
      durationMs: elapsed(),
      error: ok ? null : status >= 300 && status < 400 ? `O destino respondeu HTTP ${status}; redirecionamentos não são seguidos.` : `O destino respondeu HTTP ${status}.`,
    };
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Não foi possível falar com o destino.";
    return { status: null, excerpt: null, durationMs: elapsed(), error: message.slice(0, 300) };
  }
}
