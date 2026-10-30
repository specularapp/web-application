"use server";

import { unenrollTotp } from "@/features/auth/actions";
import { planAllows } from "@/features/billing/service";
import { firstIssue, guardAction, revalidateDomain } from "@/features/organizations/context";
import { markNotificationsRead } from "@/features/organizations/notifications";
import { cacheTags } from "@/lib/cache/tags";
import { createClient } from "@/lib/supabase/server";
import {
  avatarAttachSchema,
  avatarUploadSchema,
  changePasswordSchema,
  domainIdSchema,
  domainNameSchema,
  notificationIdsSchema,
  saveAccountSchema,
  saveResumeSchema,
  userImageClearSchema,
} from "./schemas";
import {
  attachAvatar,
  clearUserImage,
  createAvatarUpload,
  saveAccount,
  saveResume,
  type Account,
  type Resume,
} from "./service";
import type { DomainsOverview, PortfolioDomain } from "./domains";
import { addPortfolioDomain, listPortfolioDomains, removePortfolioDomain, verifyPortfolioDomain } from "./domains-service";

export type ActionError = { ok: false; error: string; field?: string };

/** O nome de quem entra. Derruba `organization`, que leva a concha e o índice da casa junto. */
export async function saveAccountAction(input: unknown): Promise<{ ok: true; account: Account } | ActionError> {
  const guard = await guardAction("account-save");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = saveAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const saved = await saveAccount(guard.context.supabase, guard.context.user.id, parsed.data);
  if (!saved.ok) return { ok: false, error: saved.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.organization], ["/configuracoes"]);
  return { ok: true, account: saved.data };
}

export async function createAvatarUploadAction(input: unknown): Promise<{ ok: true; path: string; token: string } | ActionError> {
  const guard = await guardAction("avatar-upload");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = avatarUploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Envie uma imagem PNG, JPG ou WEBP." };

  const prepared = await createAvatarUpload(guard.context.supabase, guard.context.user.id, parsed.data.contentType, parsed.data.kind);
  if (!prepared.ok) return { ok: false, error: prepared.error };
  return { ok: true, ...prepared.data };
}

export async function attachAvatarAction(input: unknown): Promise<{ ok: true; url: string } | ActionError> {
  const guard = await guardAction("avatar-attach");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = avatarAttachSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Envio inválido." };

  const attached = await attachAvatar(guard.context.supabase, guard.context.user.id, parsed.data.path, parsed.data.kind);
  if (!attached.ok) return { ok: false, error: attached.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.organization], ["/configuracoes"]);
  return { ok: true, url: attached.data };
}

/** Tira a foto ou a capa da pessoa. Derruba `organization`, porque o rosto mora na concha. */
export async function clearUserImageAction(input: unknown): Promise<{ ok: true } | ActionError> {
  const guard = await guardAction("avatar-clear");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = userImageClearSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Imagem inválida." };

  const cleared = await clearUserImage(guard.context.supabase, guard.context.user.id, parsed.data.kind);
  if (!cleared.ok) return { ok: false, error: cleared.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.organization], ["/configuracoes"]);
  return { ok: true };
}

/**
 * Trocar a senha de dentro da conta. É outra ação, e não a de redefinir por link: aquela redireciona ao
 * painel e é feita para quem chegou por e-mail; esta devolve o resultado para a página dizer o que houve.
 * Com autenticador cadastrado, o Supabase exige a sessão confirmada em duas etapas: a página manda para o
 * `/mfa` com volta para cá.
 */
export async function changePasswordAction(input: unknown): Promise<{ ok: true } | ActionError | { ok: false; error: string; mfa: true }> {
  const guard = await guardAction("password-change");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "A senha precisa ter ao menos 8 caracteres, com letra e número.", field: "password" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    if (error.code === "same_password") return { ok: false, error: "A nova senha precisa ser diferente da atual.", field: "password" };
    if (error.code === "insufficient_aal") return { ok: false, error: "Confirme o código do autenticador antes de trocar a senha.", mfa: true };
    return { ok: false, error: "Não foi possível salvar a nova senha. Tente de novo em instantes." };
  }

  return { ok: true };
}

/** Tira o autenticador da conta. Passa pela ação de auth, que já tem o teto e a mensagem certos. */
export async function removeAuthenticatorAction(factorId: unknown): Promise<{ ok: true } | ActionError> {
  const guard = await guardAction("mfa-remove");
  if (!guard.ok) return { ok: false, error: guard.error };

  const result = await unenrollTotp(factorId);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function saveResumeAction(input: unknown): Promise<{ ok: true; resume: Resume } | ActionError> {
  const guard = await guardAction("resume-save");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = saveResumeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const saved = await saveResume(guard.context.supabase, guard.context.user.id, parsed.data);
  if (!saved.ok) return { ok: false, error: saved.error, field: saved.error.includes("endereço") ? "resumeSlug" : undefined };

  return { ok: true, resume: saved.data };
}

/**
 * Os domínios do portfólio (2026-10-29). Domínio próprio é do plano Pro (`custom_domain` em `plan_entitlements`),
 * e a conferência é aqui, porque o leque é desenho e desenho se contorna; tirar e conferir são sempre permitidos.
 * Quem pode mexer (dono ou administrador) a RLS decide.
 */
export async function addDomainAction(input: unknown): Promise<{ ok: true; domain: PortfolioDomain } | ActionError | { ok: false; error: string; plan: true }> {
  const guard = await guardAction("domain-add");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = domainNameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error), field: "domain" };

  const { supabase, organizationId, user } = guard.context;
  if (!(await planAllows(supabase, organizationId, "custom_domain"))) return { ok: false, error: "Domínio próprio é do plano Pro.", plan: true };

  const saved = await addPortfolioDomain(supabase, organizationId, user.id, parsed.data.domain);
  if (!saved.ok) return { ok: false, error: saved.error, field: "domain" };

  await revalidateDomain(organizationId, [cacheTags.organization], ["/configuracoes/dominio"]);
  return { ok: true, domain: saved.data };
}

export async function verifyDomainAction(input: unknown): Promise<{ ok: true; domain: PortfolioDomain } | ActionError> {
  const guard = await guardAction("domain-verify");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = domainIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Domínio inválido." };

  const verified = await verifyPortfolioDomain(guard.context.supabase, guard.context.organizationId, parsed.data.id);
  if (!verified.ok) return { ok: false, error: verified.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.organization], ["/configuracoes/dominio"]);
  return { ok: true, domain: verified.data };
}

export async function removeDomainAction(input: unknown): Promise<{ ok: true } | ActionError> {
  const guard = await guardAction("domain-remove");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = domainIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Domínio inválido." };

  const removed = await removePortfolioDomain(guard.context.supabase, guard.context.organizationId, parsed.data.id);
  if (!removed.ok) return { ok: false, error: removed.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.organization], ["/configuracoes/dominio"]);
  return { ok: true };
}

/** A lista como está, para a tela recarregar sem trocar de página. */
export async function loadDomainsAction(): Promise<DomainsOverview | null> {
  const guard = await guardAction("domain-load");
  if (!guard.ok) return null;
  return listPortfolioDomains(guard.context.supabase, guard.context.organizationId);
}

/** Marca como lidas as notificações da lista, ou todas as que a página mostra. Derruba a concha, que conta as não lidas. */
export async function markNotificationsReadBatchAction(input: unknown): Promise<{ ok: true } | ActionError> {
  const guard = await guardAction("notifications-read");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = notificationIdsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nada para marcar." };

  await markNotificationsRead(guard.context.supabase, guard.context.user.id, parsed.data);
  await revalidateDomain(guard.context.organizationId, [cacheTags.shell], ["/configuracoes/notificacoes"]);
  return { ok: true };
}
