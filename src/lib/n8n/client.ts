import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export const N8N_SECRET_HEADER = "x-webhook-secret";

export async function triggerWorkflow(event: string, payload: unknown) {
  const { N8N_WEBHOOK_URL, N8N_WEBHOOK_SECRET } = env.n8n();
  const response = await fetch(N8N_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json", [N8N_SECRET_HEADER]: N8N_WEBHOOK_SECRET },
    body: JSON.stringify({ event, payload, sentAt: new Date().toISOString() }),
  });
  if (!response.ok) {
    throw new Error(`n8n respondeu ${response.status}`);
  }
}

export function isValidN8nRequest(request: Request) {
  const received = Buffer.from(request.headers.get(N8N_SECRET_HEADER) ?? "");
  const expected = Buffer.from(env.n8n().N8N_WEBHOOK_SECRET);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
