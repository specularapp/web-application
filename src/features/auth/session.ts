import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function requireUser(next = "/dashboard") {
  const user = await getCurrentUser();
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
