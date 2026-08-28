import { isValidN8nRequest } from "@/lib/n8n/client";
import { payloadTooLargeResponse, readTextWithLimit } from "@/lib/security/payload";

export async function POST(request: Request) {
  if (!isValidN8nRequest(request)) return new Response("Não autorizado", { status: 401 });

  let raw: string;
  try {
    raw = await readTextWithLimit(request);
  } catch {
    return payloadTooLargeResponse();
  }

  const payload: unknown = ((): unknown => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  })();
  if (payload === null) return new Response("JSON inválido", { status: 400 });

  return Response.json({ received: true });
}
