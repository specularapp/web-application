"use server";

import type { Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { siteConfig } from "@/lib/metadata";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  factorIdSchema,
  friendlyNameSchema,
  nextPathSchema,
  oauthProviderSchema,
  totpCodeSchema,
} from "./schemas";

type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const TOO_MANY = "Muitas tentativas. Aguarde um instante e tente de novo.";

async function withinAuthLimit(operation: string) {
  const headerStore = await headers();
  const ip = clientIp(headerStore);
  const { allowed } = await checkRateLimit("auth", `${operation}:${ip}`, crypto.randomUUID());
  return allowed;
}

export async function signInWithOAuth(provider: unknown, next?: unknown): Promise<never> {
  if (!(await withinAuthLimit("oauth"))) redirect("/login?erro=limite");

  const parsedProvider = oauthProviderSchema.safeParse(provider);
  if (!parsedProvider.success) redirect("/login?erro=provedor");

  const redirectTo = new URL("/auth/callback", siteConfig.url);
  redirectTo.searchParams.set("next", nextPathSchema.parse(next ?? "/dashboard"));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: parsedProvider.data,
    options: { redirectTo: redirectTo.toString() },
  });

  if (error || !data.url) redirect(`/login?erro=${parsedProvider.data}`);
  redirect(data.url as Route);
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function listTotpFactors() {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp ?? [];
}

export async function enrollTotp(
  friendlyName: unknown,
): Promise<ActionResult<{ factorId: string; qrCode: string; secret: string }>> {
  if (!(await withinAuthLimit("enroll"))) return { ok: false, error: TOO_MANY };

  const name = friendlyNameSchema.safeParse(friendlyName);
  if (!name.success) return { ok: false, error: "Nome do autenticador inválido" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: name.data });
  if (error) return { ok: false, error: "Não foi possível iniciar o cadastro do autenticador" };

  return { ok: true, data: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret } };
}

export async function verifyTotp(factorId: unknown, code: unknown): Promise<ActionResult> {
  if (!(await withinAuthLimit("totp"))) return { ok: false, error: TOO_MANY };

  const id = factorIdSchema.safeParse(factorId);
  const totp = totpCodeSchema.safeParse(code);
  if (!id.success || !totp.success) return { ok: false, error: "Código inválido" };

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: id.data, code: totp.data });
  if (error) return { ok: false, error: "Código inválido ou expirado" };

  return { ok: true, data: undefined };
}

export async function unenrollTotp(factorId: unknown): Promise<ActionResult> {
  if (!(await withinAuthLimit("unenroll"))) return { ok: false, error: TOO_MANY };

  const id = factorIdSchema.safeParse(factorId);
  if (!id.success) return { ok: false, error: "Autenticador inválido" };

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId: id.data });
  if (error) return { ok: false, error: "Não foi possível remover o autenticador. Confirme o código atual antes." };

  return { ok: true, data: undefined };
}
