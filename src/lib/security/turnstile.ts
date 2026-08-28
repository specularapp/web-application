import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const responseSchema = z.object({
  success: z.boolean(),
  "error-codes": z.array(z.string()).optional(),
});

export const turnstileTokenSchema = z.string().min(1).max(2048);

export async function verifyTurnstile(token: unknown, remoteIp?: string): Promise<boolean> {
  const parsed = turnstileTokenSchema.safeParse(token);
  if (!parsed.success) return false;

  const body = new URLSearchParams({
    secret: env.turnstile().TURNSTILE_SECRET_KEY,
    response: parsed.data,
  });
  if (remoteIp && remoteIp !== "desconhecido") body.set("remoteip", remoteIp);

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return false;
    const result = responseSchema.safeParse(await response.json());
    return result.success && result.data.success;
  } catch {
    return false;
  }
}
