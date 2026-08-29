"use server";

import type { Route } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasTurnstile } from "@/lib/env";
import { siteConfig } from "@/lib/metadata";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { TURNSTILE_FIELD_NAME } from "@/lib/security/turnstile-field";
import { REMEMBER_COOKIE, rememberCookie } from "@/lib/supabase/cookies";
import { createClient } from "@/lib/supabase/server";
import {
  factorIdSchema,
  friendlyNameSchema,
  nextPathSchema,
  oauthProviderSchema,
  signInSchema,
  totpCodeSchema,
} from "./schemas";

type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export type SignInState = { error?: string };

const TOO_MANY = "Muitas tentativas. Aguarde um instante e tente de novo.";
const NOT_HUMAN = "Não conseguimos confirmar que você não é um robô. Recarregue a página e tente de novo.";

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

export async function signInWithPassword(_state: SignInState, formData: FormData): Promise<SignInState> {
  if (!(await withinAuthLimit("password"))) return { error: TOO_MANY };

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    remember: formData.get("remember") === "on",
  });
  if (!parsed.success) return { error: "Confira o e-mail e a senha informados." };

  if (hasTurnstile()) {
    const headerStore = await headers();
    const human = await verifyTurnstile(formData.get(TURNSTILE_FIELD_NAME), clientIp(headerStore));
    if (!human) return { error: NOT_HUMAN };
  }

  const { email, password, remember } = parsed.data;
  const cookieStore = await cookies();
  cookieStore.set(REMEMBER_COOKIE, remember ? "1" : "0", rememberCookie(remember));

  const supabase = await createClient({ remember });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "E-mail ou senha incorretos." };

  redirect(nextPathSchema.parse(formData.get("next")) as Route);
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
