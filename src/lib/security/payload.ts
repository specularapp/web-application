import "server-only";

export const MAX_WEBHOOK_BYTES = 1_048_576;

export class PayloadTooLargeError extends Error {
  constructor() {
    super("Corpo da requisição excede o limite");
    this.name = "PayloadTooLargeError";
  }
}

/**
 * Lê o corpo como texto recusando o que passar do limite.
 * Checa o Content-Length antes e conta os bytes durante a leitura,
 * porque o cabeçalho pode mentir ou faltar em transferência chunked.
 */
export async function readTextWithLimit(request: Request, maxBytes: number = MAX_WEBHOOK_BYTES) {
  const declared = Number(request.headers.get("content-length") ?? Number.NaN);
  if (Number.isFinite(declared) && declared > maxBytes) throw new PayloadTooLargeError();

  const body = request.body;
  if (!body) return "";

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new PayloadTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(merged);
}

export function payloadTooLargeResponse() {
  return new Response("Corpo da requisição excede o limite", { status: 413 });
}
