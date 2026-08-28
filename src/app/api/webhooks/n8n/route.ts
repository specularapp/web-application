import { isValidN8nRequest } from "@/lib/n8n/client";

export async function POST(request: Request) {
  if (!isValidN8nRequest(request)) return new Response("Não autorizado", { status: 401 });

  const payload: unknown = await request.json().catch(() => null);
  if (payload === null) return new Response("JSON inválido", { status: 400 });

  return Response.json({ received: true });
}
