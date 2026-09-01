"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireUser } from "@/features/auth/session";
import { siteConfig } from "@/lib/metadata";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  createInviteSchema,
  imageAttachSchema,
  imageUploadSchema,
  inviteRemovalSchema,
  inviteTokenSchema,
  memberRemovalSchema,
  memberRoleChangeSchema,
  organizationIdSchema,
  saveTeamSchema,
} from "./schemas";
import {
  acceptInvite,
  attachImage,
  cancelInvite,
  changeMemberRole,
  completeOnboarding,
  createImageUpload,
  getTeamState,
  inviteMember,
  removeMember,
  saveTeam,
  type ServiceResult,
  type Team,
  type TeamInvite,
} from "./service";

const DASHBOARD_PATH = "/dashboard";
const TOO_MANY = "Muitas ações em pouco tempo. Aguarde um instante e tente de novo.";
const INVALID = "Confira os dados informados.";

async function withinActionLimit(operation: string, userId: string) {
  const { allowed } = await checkRateLimit("action", `${operation}:${userId}`, crypto.randomUUID());
  return allowed;
}

export async function saveTeamAction(input: unknown): Promise<ServiceResult<Team>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("team", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = saveTeamSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "website") return { ok: false, error: "Confira o endereço do site, algo como specular.com.br" };
    if (field === "name") return { ok: false, error: "O nome do time precisa ter entre 2 e 80 caracteres." };
    if (field === "industry") return { ok: false, error: "Escolha a área de atuação do time." };
    return { ok: false, error: INVALID };
  }

  const supabase = await createClient();
  const result = await saveTeam(supabase, parsed.data);
  if (result.ok) revalidatePath(DASHBOARD_PATH);
  return result;
}

export async function inviteMemberAction(input: unknown): Promise<ServiceResult<TeamInvite>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("invite", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = createInviteSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "name") return { ok: false, error: "Diga o nome de quem você está convidando." };
    return { ok: false, error: "Confira o e-mail informado." };
  }

  // Teto por destinatário: sem ele o formulário de convite vira disparador de e-mail para terceiros.
  const perTarget = await checkRateLimit("authEmail", `invite:${parsed.data.email}`, crypto.randomUUID());
  if (!perTarget.allowed) return { ok: false, error: TOO_MANY };

  const supabase = await createClient();
  const state = await getTeamState(supabase, user.id);
  if (!state.team || state.team.id !== parsed.data.organizationId) {
    return { ok: false, error: "Time não encontrado." };
  }

  const result = await inviteMember(supabase, parsed.data, {
    origin: siteConfig.url,
    teamName: state.team.name,
    inviterName: (user.user_metadata?.full_name as string | undefined) ?? null,
  });

  if (result.ok) revalidatePath(DASHBOARD_PATH);
  return result;
}

export async function changeMemberRoleAction(input: unknown): Promise<ServiceResult<undefined>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("role", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = memberRoleChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const result = await changeMemberRole(supabase, parsed.data);
  if (result.ok) revalidatePath(DASHBOARD_PATH);
  return result;
}

export async function removeMemberAction(input: unknown): Promise<ServiceResult<undefined>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("remove", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = memberRemovalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const result = await removeMember(supabase, parsed.data);
  if (result.ok) revalidatePath(DASHBOARD_PATH);
  return result;
}

export async function cancelInviteAction(input: unknown): Promise<ServiceResult<undefined>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("invite-cancel", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = inviteRemovalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const result = await cancelInvite(supabase, parsed.data);
  if (result.ok) revalidatePath(DASHBOARD_PATH);
  return result;
}

export async function createImageUploadAction(input: unknown): Promise<ServiceResult<{ path: string; token: string }>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("image", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = imageUploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Envie uma imagem PNG, JPG ou WEBP." };

  const supabase = await createClient();
  return createImageUpload(supabase, parsed.data);
}

export async function attachImageAction(input: unknown): Promise<ServiceResult<string>> {
  const user = await requireUser(DASHBOARD_PATH);
  if (!(await withinActionLimit("image-attach", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = imageAttachSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const result = await attachImage(supabase, parsed.data);
  if (result.ok) revalidatePath(DASHBOARD_PATH);
  return result;
}

export async function acceptInviteAction(token: unknown): Promise<ServiceResult<string>> {
  const user = await requireUser("/dashboard");
  if (!(await withinActionLimit("accept", user.id))) return { ok: false, error: TOO_MANY };

  const parsed = inviteTokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false, error: "Este convite não está completo. Abra o link do e-mail de novo." };

  const supabase = await createClient();
  const result = await acceptInvite(supabase, parsed.data);
  if (result.ok) {
    revalidatePath(DASHBOARD_PATH);
  }
  return result;
}

export async function finishOnboardingAction(input: unknown): Promise<ServiceResult<undefined>> {
  const user = await requireUser(DASHBOARD_PATH);
  const headerStore = await headers();
  if (!(await withinActionLimit("finish", `${user.id}:${clientIp(headerStore)}`))) {
    return { ok: false, error: TOO_MANY };
  }

  const parsed = organizationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const result = await completeOnboarding(supabase, parsed.data.organizationId);
  if (result.ok) {
    revalidatePath(DASHBOARD_PATH);
  }
  return result;
}
