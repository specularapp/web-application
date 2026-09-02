import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** O que as actions e as páginas realmente leem da sessão. */
export type SessionUser = {
  id: string;
  email: string | null;
  fullName: string | null;
};

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/**
 * Sessão por `getClaims`, e não por `getUser`: o primeiro confere a assinatura do JWT com a chave
 * pública do projeto, sem sair da máquina, e o segundo é uma ida ao servidor de auth. Cada action do
 * fluxo de primeiros passos chamava isso uma vez, e a viagem custa uns 300ms de onde estamos; num
 * passo com cinco actions em série, era mais de um segundo só conferindo a mesma sessão.
 *
 * O que se perde: um token emitido antes de a conta ser apagada ou bloqueada continua válido até
 * expirar, em uma hora. É o mesmo compromisso que o proxy já faz para proteger rota, e a RLS continua
 * decidindo tudo no banco com esse mesmo token.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const metadata = claims.user_metadata;
  const fullName = typeof metadata?.full_name === "string" ? metadata.full_name : null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    fullName,
  };
}

export async function requireUser(next = "/dashboard"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function getAssuranceLevel() {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data;
}

export async function requireMfaSatisfied(next = "/dashboard") {
  const level = await getAssuranceLevel();
  if (level?.currentLevel === "aal1" && level.nextLevel === "aal2") {
    redirect(`/mfa?next=${encodeURIComponent(next)}`);
  }
}
